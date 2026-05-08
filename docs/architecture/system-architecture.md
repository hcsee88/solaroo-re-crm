# Solaroo RE CRM — System Architecture

**Date:** 2026-04-13 (last reviewed: 2026-05-08)  
**Status:** Living document — updated as build progresses  
**Company:** Pekat Teknologi Sdn Bhd (internal platform, not SaaS)

---

## Current direction (2026-05-08)

**Next module: Sales Pipeline Monitoring V1.** O&M deferred. The architectural surface needed for the next sprint is small and additive:

- Existing `Activity` table extended (`activityType`, `nextActionType`, `nextActionStatus`, `nextActionOwnerId`, `nextActionCompletedAt`, `lastStatusNote`) — already in `crm.prisma`.
- Existing `Opportunity` model gains computed-at-read health indicator (`Healthy / At Risk / Stale / Overdue`) — no new column.
- Existing `SavedView` table reused for opportunity-list saved filters.
- Existing `Notification` table reused for hook-point alerts (`overdue_next_action`, `proposal_no_followup`, `opportunity_stale`) fired by the worker.
- New page: `/sales-pipeline` (read-only dashboard reusing reporting endpoints).

**No new major module** is introduced for this sprint — it's an enhancement layer over `crm`, `proposals`, and `audit/notifications`. Sales activity logging is **manual only**: no email / WhatsApp / call / Outlook / Gmail / calendar / telephony / AI integration in V1.

See `docs/v1-product-direction.md` for the full Sales Pipeline V1 scope and rationale.

---

## What This System Is

A single-company internal platform covering the full lifecycle of off-grid solar, hybrid solar-diesel, and BESS projects — from first customer contact through O&M handover. Also functions as a light ERP (procurement, invoicing milestones, contract tracking) and document control system.

**Target users:** 15 now, ~30 in two years.  
**Lifecycle covered:** Account → Site → Opportunity → Proposal → Contract → Project → Commissioning → Asset Register → O&M

---

## Architecture Pattern

**Modular monolith.** One backend codebase, one frontend codebase, one database. Modules are separated by domain boundaries within the same deployable unit — not split into microservices.

**Rationale:**
- 15–30 users. Microservices add infrastructure complexity with no benefit at this scale.
- All domains share the same database — splitting them would require distributed transactions and cross-service joins.
- One backend to debug, one deployment to manage, one Prisma schema to reason about.

---

## Runtime Components

```
┌──────────────────────────────────────────────────────────┐
│  Browser (Next.js 14 App Router — port 3000)             │
│  TypeScript + Tailwind CSS + shadcn/ui                   │
│  React Query for server state                            │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTPS — REST API calls
                     │ httpOnly cookie (session token)
┌────────────────────▼─────────────────────────────────────┐
│  NestJS + Fastify (port 4000)                            │
│  JWT auth (httpOnly cookie)                              │
│  Permission guard (AUTHZ_ENFORCE=true)                   │
│  Zod validation at all API boundaries                    │
│  BullMQ job producer (workflow triggers)                 │
└───────┬──────────────────┬───────────────────────────────┘
        │                  │
┌───────▼──────┐   ┌───────▼───────────────────────────────┐
│  PostgreSQL  │   │  Redis                                │
│  (Docker)    │   │  BullMQ queues + job state            │
│  Prisma ORM  │   └───────┬───────────────────────────────┘
│  Split schema│           │
│  per domain  │   ┌───────▼───────────────────────────────┐
└──────────────┘   │  BullMQ Worker (separate process)     │
                   │  Handles: stage transitions, notifs,  │
                   │  PDF generation, email dispatch        │
                   └───────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  S3-compatible object storage (planned)                  │
│  Proposal PDFs, drawings, site photos, documents         │
│  Metadata stored in PostgreSQL                           │
└──────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

**Framework:** Next.js 14 App Router

### Route Groups

```
(auth)/login              — public, no session required
(app)/                    — all business pages, protected by middleware
  dashboard/
  accounts/[id]/
  contacts/
  sites/
  opportunities/[id]/
  proposals/[id]/
  projects/[id]/
  pmo/
  procurement/
  documents/
  om/
  reports/
  admin/users/            — SUPER_ADMIN only
```

### State Management

- **React Query** — all server data (caching, background refetch, loading states)
- **useState / useCallback** — local component state
- No global client-side store (Redux/Zustand not warranted at this scale)

### Role-Based UI

- Central config in `apps/web/src/lib/role-ui.ts` — single source of truth
- Pure functions: `canSeeProposalCapex()`, `canSeeProposalMargin()`, `canSeeOpportunityValue()`, `getNavItemsForRole()`, etc.
- Applied at render time — sidebar, table columns, dashboard sections all conditioned by role
- Complements (does not replace) backend auth enforcement

### API Client

- Thin axios wrapper in `apps/web/src/lib/api-client.ts`
- 401 → redirect to `/login`
- 403 → redirect to `/forbidden`
- All session cookies are httpOnly — frontend never reads the token directly

---

## Backend Architecture

**Framework:** NestJS with Fastify adapter

### Domain Modules

| Module | Responsibility |
|---|---|
| auth | Login, JWT, session management, `/auth/me` |
| accounts | Account CRUD, ACC-XXXX codes |
| contacts | Contacts linked to accounts |
| sites | Sites linked to accounts, grid category, coordinates |
| opportunities | Stage transitions (state machine), pipeline, OPP-YY-XXX codes |
| proposals | Proposal versions, assumptions, approval workflow |
| contracts | Contracts, milestones, invoice tracking |
| projects | Created from won opportunity, gates, milestones |
| gates | Structured gate checklists, approval states |
| procurement | Vendors, RFQs, POs, deliveries, equipment serials |
| documents | Revisions, approvals, transmittals |
| assets | Created at commissioning/handover only |
| maintenance | Plans, records, service tickets, warranty claims |
| reporting | Dashboard aggregates, pipeline health, project health |
| admin | User management, role assignment (SUPER_ADMIN only) |
| ai | Summarization, extraction, Q&A from internal data (planned) |

### Request Lifecycle

```
Incoming Request
  → JwtAuthGuard       — validates httpOnly cookie, attaches user to request
  → PermissionGuard    — checks user.role.permissions against required permission string
  → ZodValidationPipe  — validates @Body() and @Query() against Zod schema
  → Controller         — routes to service, returns raw data (never double-wraps)
  → ResponseInterceptor — wraps all responses in { success: true, data: ... }
  → Response
```

### Permission Model

- Every API endpoint declares a required permission string (e.g. `proposal:create`, `reporting:view`)
- Permissions are assigned to roles in the database — not hardcoded in application logic
- Two scope levels:
  - `:all` — user can see all records of that type
  - `:assigned` — user can only see records they own or are assigned to
- `AUTHZ_ENFORCE=true` in production: returns 403 on unauthorized access
- `AUTHZ_ENFORCE=false` in development: logs violation but allows through (audit-only mode)

---

## Database Architecture

**PostgreSQL** with **Prisma ORM**. Schema split into domain files:

| Schema file | Contains |
|---|---|
| `auth.prisma` | users, roles, permissions, role_permissions |
| `crm.prisma` | accounts, contacts, sites, opportunities, activities, notes |
| `proposals.prisma` | proposals, proposal_versions, proposal_assumptions, approvals |
| `projects.prisma` | projects, gates, gate_checklist_items, milestones, tasks, issues, risks |
| `procurement.prisma` | vendors, rfqs, purchase_orders, deliveries, equipment_serials |
| `documents.prisma` | documents, document_revisions, document_approvals, transmittals |
| `contracts.prisma` | contracts, contract_milestones, invoices, budgets |
| `om.prisma` | assets, maintenance_plans, maintenance_records, service_tickets, warranty_claims |
| `audit.prisma` | audit_logs, notifications, saved_views |

### Key Data Model Rules

- Opportunity stages are a controlled state machine — no arbitrary stage jumps
- Proposal versions are immutable after approval — changes require a new version
- Every proposal version references a frozen assumption set
- A won opportunity automatically creates a project record — never manually
- Assets are only created at commissioning/handover — not before
- Warranty dates captured per installed asset (serial level where possible)
- All approvals and critical status changes write to `audit_log`

---

## Security Architecture

Two independent layers — both must hold:

| Layer | Mechanism | What it enforces |
|---|---|---|
| Backend | `PermissionGuard` + `AUTHZ_ENFORCE=true` | Blocks unauthorized API calls with 403 |
| Frontend | `role-ui.ts` pure functions | Hides UI elements irrelevant to a role |

If the frontend is bypassed (direct URL, curl, Postman), the backend still blocks unauthorized access. If the backend is in permissive mode (dev), the frontend still hides sensitive fields from non-authorized roles.

### Sensitive Fields — Tightest Access Control

| Field | Visible to |
|---|---|
| Proposal Margin % | DIRECTOR, SALES_MANAGER, FINANCE_ADMIN |
| Proposal CAPEX | DIRECTOR, SALES_MANAGER, FINANCE_ADMIN |
| Opportunity Value (RM) | DIRECTOR, SALES_MANAGER, SALES_ENGINEER, FINANCE_ADMIN |
| Pipeline total value | DIRECTOR, SALES_MANAGER only |
| Stage value breakdown | DIRECTOR, SALES_MANAGER only |

---

## Background Jobs (BullMQ)

The API produces jobs to Redis queues. A separate BullMQ Worker process consumes them independently.

### Planned Job Types

| Job | Trigger |
|---|---|
| Auto-create project | Opportunity stage changes to WON |
| Approval notification | Proposal or gate submitted for review |
| Overdue action alert | Daily scan of opportunities with missed next action dates |
| PDF generation | Proposal version approved / document revision issued |
| O&M maintenance reminder | Scheduled maintenance plan due date approaching |
| Audit log batch write | High-volume event buffering |

The worker is a separate Node.js process but shares the same database and type packages from the monorepo.

---

## AI Module (Planned)

Scoped to read-only operations against internal data. AI does not directly modify records.

| Capability | Description |
|---|---|
| Project status summary | Summarize from gates, milestones, issues |
| Proposal narrative draft | Draft from assumption set inputs |
| Document Q&A | RAG over uploaded site assessments and reports |
| Data extraction | Extract structured data from uploaded PDFs |

**Rules:**
- All AI outputs are drafts or suggestions — user must confirm before any record is modified
- Prompts are modular and domain-specific, stored in `/packages/ai-prompts`
- Role-based filtering applies — AI responses only expose data the caller's role can see
- Source references shown when answering from internal data

---

## Monorepo Structure

```
apps/
  web/          Next.js 14 frontend (port 3000)
  api/          NestJS + Fastify backend (port 4000)
packages/
  db/           Prisma schema + migrations + generated client
  types/        Shared TypeScript types (domain DTOs, enums)
  workflows/    Stage transition maps, gate checklists (state machine definitions)
  ui/           Shared shadcn/ui components
  config/       Shared env schemas, constants
  ai-prompts/   Domain-specific AI prompt templates
services/
  worker/       BullMQ job consumer (separate process)
docs/
  architecture/ — System design documents (this file)
  data-model/   — Schema and ERD notes
  api/          — API reference
  workflows/    — State machine and transition docs
  adr/          — Architecture decision records
dev_log/        — Session logs and progress summaries
```

**Package import rule:** All cross-package imports use workspace names (`@solaroo/db`, `@solaroo/types`, etc.). Relative imports across package boundaries are not permitted.

---

## Deployment Model (Target)

```
Single Linux VM / VPS
  ├── Docker Compose
  │     ├── postgres   (persistent volume)
  │     └── redis      (persistent volume)
  ├── PM2 or systemd
  │     ├── api        (NestJS, port 4000)
  │     ├── worker     (BullMQ worker)
  │     └── web        (Next.js, port 3000)
  └── Nginx reverse proxy
        ├── /api  → :4000
        ├── /     → :3000
        └── TLS termination (Let's Encrypt)
```

No Kubernetes, no multi-region, no CDN required at 30 users. Operationally maintainable by a non-DevOps team.

---

## Build Progress

| # | Module | Status |
|---|---|---|
| 1 | Auth + roles + permissions | ✅ Complete |
| 2 | Accounts, Contacts, Sites | ✅ Complete |
| 3 | Opportunities + stage history | ✅ Complete |
| 4 | Proposals + versions + assumptions | ✅ Complete |
| 5 | Projects + gates + PMO | ✅ Complete |
| 6 | Role-based UI visibility | ✅ Complete |
| 7 | Document control | ⬜ Next |
| 8 | Procurement | ⬜ Planned |
| 9 | O&M module | ⬜ Planned |
| 10 | Reporting (full) | ⬜ Planned |
| 11 | Contracts + invoicing | ⬜ Planned |
| 12 | AI module | ⬜ Planned |

The core project lifecycle (Account → Site → Opportunity → Proposal → Project → Gates) is fully operational. Remaining modules are additive — they extend the platform without restructuring what is already built.
