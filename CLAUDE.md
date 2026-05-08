# CLAUDE.md

## Project name
Solaroo RE CRM

## Company
Pekat Teknologi Sdn Bhd — internal single-company platform. Not a SaaS product.

## Product purpose
A project-lifecycle CRM for off-grid solar, hybrid solar-diesel, and BESS projects. Supports the full lifecycle from lead and technical assessment through proposal, contract, engineering execution, commissioning, and O&M. Also serves as a light ERP and document control platform.

## Business context
The company delivers off-grid solar and BESS projects. Typical customers include plantations, islands, resorts, C&I facilities, rural sites, and weak-grid users. Projects may involve diesel displacement, solar hybridization, microgrid design, and peak shaving BESS.

## Core lifecycle
Account → Contact → Site → Opportunity → Activity / Next Action → Proposal → Contract → Project → Commissioning → Asset Register → O&M

> **2026-05-08 — sales discipline layer:** the `Activity / Next Action` stop is part of Sales Pipeline Monitoring V1. Activities are manual CRM records (call / email / WhatsApp / meeting / site visit / proposal follow-up / general note). They are not integrated with email / WhatsApp / telephony / calendar / AI in V1. See `docs/sales-activity-v1.md`, `docs/opportunity-health-rules.md`, and `docs/sales-dashboard-v1.md`.

## Team size
15 users now. Expected to double in ~2 years. Design for ~30 concurrent users.

---

## Architecture rules

- Use **modular monolith** architecture. Do not split into separate services unless explicitly instructed.
- Use **TypeScript** across frontend and backend.
- Use **PostgreSQL** as the primary system of record.
- Use **Prisma** for schema and migrations. Schema files split by domain (auth.prisma, crm.prisma, etc.).
- Use clear domain module boundaries. Each module has: controller/route, service, repository, schema/validation, dto/types, tests, permissions, workflow hooks.
- Keep business rules out of UI components.
- Use **server-side validation** (zod) for all mutations.
- Store files in object storage; store metadata in PostgreSQL.
- Record audit logs for approvals and critical status changes.
- Use **BullMQ + Redis** for background jobs and workflow triggers.

---

## Domain rules

- Opportunity stages must be controlled by explicit transitions (no arbitrary stage jumps).
- Proposal versions must be immutable after approval — changes require a new version.
- Every proposal version must reference a frozen assumption set.
- A won opportunity generates a project record automatically (never manually).
- Project gates must have structured checklists and approval states.
- Gate closure must be auditable.
- Documents must support revision control and approval status tracking.
- Assets are created at commissioning/handover stage, not before.
- Warranty dates must be captured per installed asset (serial level where possible).

---

## Main modules

- auth
- accounts
- contacts
- sites
- opportunities
- technical-assessment
- proposals
- contracts
- projects
- gates
- procurement
- documents
- assets
- maintenance
- reporting
- ai
- admin

---

## Folder structure

```
/apps
  /web          Next.js frontend
  /api          Backend API (Next.js API routes or NestJS)
/packages
  /ui           Shared shadcn/ui components
  /types        Shared TypeScript types
  /db           Prisma schema + migrations + client
  /config       Shared config (env schemas, constants)
  /workflows    Workflow definitions and transition maps
  /documents    Document utilities
  /ai-prompts   Domain-specific AI prompt templates
/services
  /worker       BullMQ worker service
/docs
  /architecture
  /data-model
  /api
  /workflows
  /adr
/infrastructure
  /docker
  /terraform
```

---

## Coding standards

- Use strong typing and zod for validation at API boundaries.
- Prefer small, testable services.
- Keep naming explicit and domain-oriented.
- Avoid generic names: `data`, `item`, `stuff`, `temp`, `obj`, `res` (unless framework convention).
- Use consistent domain names: `opportunity`, `proposalVersion`, `projectGate`, `maintenanceRecord`.
- Write tests for business-critical services and workflow transitions.
- API routes follow REST conventions with consistent resource naming.

---

## UX standards

- Forms structured by domain sections, not one giant form.
- Important pages show: status, owner, next action, and linked records.
- Lists must be filterable, searchable, and exportable.
- Dashboards are practical and operations-focused (not just pretty).
- Mobile-responsive required for site team pages (site diary, photo upload, punch list, commissioning checklist).

---

## AI guidelines

- AI can summarize, extract, draft, and answer questions from internal data.
- AI must not directly modify critical records without user confirmation.
- AI outputs are persisted as drafts or suggestions, not directly applied.
- Respect role-based permissions when generating AI responses.
- Source references should be shown when answering from internal data.
- Keep prompts modular and domain-specific (stored in /packages/ai-prompts).

---

## Role matrix

| Role | Key access |
|---|---|
| Director / Management | Full dashboards, margin, approvals, all projects |
| Sales Manager | Accounts, opportunities, proposals, commercial reporting |
| Sales Engineer | Opportunities, site assessments, proposal drafting |
| Project Manager | Projects, gates, issues, risks, documents, milestones |
| Design Engineer | Technical assessments, DBD, drawings, review workflows |
| Procurement | Vendors, RFQs, quotes, POs, deliveries |
| Site Supervisor | Site updates, punch lists, checklists, progress logs |
| Commissioning Engineer | Testing sheets, handover docs, asset register |
| O&M Engineer | Asset history, tickets, maintenance, warranty |
| Finance/Admin | Contracts, invoice milestones, payment status |

---

## Permission rules

- Margin and sensitive commercial fields are restricted (Director, Sales Manager only).
- Proposal issuance requires approval rights.
- Gate closure requires designated approver rights.
- Document revision supersession restricted to document owner/approver.
- Audit log on all status changes, approvals, and key field edits.

---

## Prisma schema groups

- `auth.prisma` — users, roles, permissions, teams
- `crm.prisma` — accounts, contacts, sites, opportunities, activities, notes
- `proposals.prisma` — proposals, proposal_versions, proposal_assumptions, proposal_approvals
- `projects.prisma` — projects, gates, milestones, tasks, issues, risks, rfis, submittals, variations
- `procurement.prisma` — vendors, products, rfqs, purchase_orders, deliveries, equipment_serials
- `documents.prisma` — documents, document_revisions, document_approvals, transmittals
- `contracts.prisma` — contracts, contract_milestones, invoices, budgets, cost_updates
- `om.prisma` — assets, maintenance_plans, maintenance_records, service_tickets, warranty_claims
- `audit.prisma` — audit_logs, notifications, saved_views

---

## MVP build order

1. Auth and roles
2. Accounts, contacts, sites
3. Opportunities and stage history
4. Proposal versions and assumptions
5. Project creation from won opportunity
6. Gate tracker
7. Document control
8. Dashboards
9. Procurement
10. O&M module

---

## Current recommendation (2026-05-08)

**Next priority: Sales Pipeline Monitoring V1 — not O&M yet.**

Items 1–9 of the MVP build order are substantially in place (auth, accounts/contacts/sites, opportunities, proposals + versions, contracts + handover, project gates, documents, PMO dashboard, procurement, reports). O&M (item 10) remains important but is **deferred**.

Reason: the system holds opportunity and proposal records, but the **sales operating rhythm is still weak**. Management lacks daily visibility into overdue follow-ups, stale opportunities, opportunities without a next action, proposal follow-up status, salesperson activity, expected close dates, pipeline forecast, and overall sales pipeline health. This must be tightened before expanding the post-commissioning lifecycle.

**Important product decision — manual only in V1.**

Sales activity tracking remains **manual logging only**. Do **not** introduce email / WhatsApp / call / Outlook / Gmail / telephony / calendar / AI integrations for V1. Salespeople perform actions outside the CRM (call, email, WhatsApp, meeting, site visit) and then manually log them as activity records. The discipline tool is the **next-action due date**, surfaced by health indicators on every opportunity.

**Recommended build sequence:**

1. Sales Activity Logging — manual only
2. Opportunity Next Action Tracking
3. Opportunity Health Indicators
4. Opportunity List Filters + Saved Views
5. Sales Pipeline Dashboard
6. Sales Notification Hook Points (in-app only)
7. Demo Fixture Data
8. Mobile Site Supervisor UX
9. O&M Module

See `docs/v1-product-direction.md` and `dev_log/dev_log_260508.txt` for full rationale.

---

## What good output looks like

- Clean domain model that maps directly to business concepts
- Explicit, typed APIs with consistent naming
- Minimal duplication — no logic repeated across modules
- Business workflows reflected in code (state machines, not arbitrary updates)
- Every commercial and project action is auditable
