# Solaroo RE CRM — Review Document for ChatGPT

**Prepared:** 2026-04-25
**Audience:** ChatGPT (or any external reviewer) being asked to recommend the next stage of work
**Purpose:** Give a complete, honest picture of what's built, what's stub, what's missing, and the constraints we're operating under — so the recommendation is realistic, not generic.

---

## 1. Product context

**What it is:** Internal project-lifecycle CRM for Pekat Teknologi Sdn Bhd, a Malaysian off-grid solar / hybrid solar-diesel / BESS contractor. Not a SaaS product — single tenant, ~15 users today, planning for ~30 concurrent in 2 years.

**End-to-end lifecycle the system is supposed to support:**
```
Account → Site → Opportunity → Proposal → Contract → Project (Gates 1-6) → Commissioning → Asset Register → O&M
```

**Roles (14 total):** SUPER_ADMIN, DIRECTOR, PMO_MANAGER, SALES_MANAGER, SALES_ENGINEER, PROJECT_MANAGER, PROJECT_ENGINEER, DESIGN_LEAD, DESIGN_ENGINEER, PROCUREMENT, SITE_SUPERVISOR, COMMISSIONING_ENGINEER, OM_ENGINEER, FINANCE_ADMIN.

**Permission model:** 268 distinct permissions, scoped (own / assigned / team / all), enforced both at the controller (`@RequirePermission(resource, action)`) and at the service layer (`authz.requirePermission(...)` for record-level scope checks).

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| Backend API | NestJS 10 with Fastify, TypeScript, webpack-bundled for production |
| ORM / DB | Prisma 5.22 + PostgreSQL 16 (multi-file schema split by domain) |
| Worker | Standalone Node process; uses `setInterval` for scheduled jobs (no Redis/BullMQ deployed) |
| Auth | JWT in httpOnly cookie, custom permission engine, AuthzService caches role permissions for 60s |
| Validation | Zod schemas at all API boundaries |
| Hosting | Railway Hobby plan ($5/mo) — Web + API + PostgreSQL services |
| Local dev | pnpm monorepo, `pnpm dev` runs all three services in parallel via Turbo |

**Repo layout:**
```
apps/api          NestJS API (single application; not microservices)
apps/web          Next.js 14 frontend
packages/db       Prisma schema + client + seed
packages/types    Shared TypeScript types + Resource/Action/Scope unions
packages/workflows  State machine helpers (opportunity stage transitions, gate templates)
packages/ui       Shared React components (light usage)
packages/config   Shared config (light usage)
packages/documents  Document utilities (light usage)
packages/ai-prompts Reserved for AI features
services/worker   Background worker (digest job)
docs              Markdown architecture docs
```

---

## 3. What is solid (production-ready end-to-end)

| Module | Status | Notes |
|---|---|---|
| **Auth + Roles + Permissions** | ✅ Solid | 14 roles, 268 permissions, scope-aware, audit-mode toggle via `AUTHZ_ENFORCE` env var |
| **Accounts / Contacts / Sites** | ✅ Solid | Full CRUD, list + detail + create/edit pages |
| **Opportunities** | ✅ Solid | Stage state machine with auto-validations (e.g. WON requires PM + project code), stage history, members |
| **Proposals** | ✅ Solid | Versioned, immutable after approval, frozen assumption sets, approval workflow |
| **Contracts + Award→Handover** | ✅ Solid (built this session) | Full CRUD, dual status (ContractStatus + HandoverStatus), checklist gating, auto-creates/links Project on handover-completed, milestones, invoices, variance panel, signed-PDF document linkage |
| **Projects + Gates** | ✅ Solid | 6-gate template, deliverables, member management, blocker workflow, RAG status, gate approvals, per-gate audit trail |
| **Documents** | ✅ Solid | Upload, revision history, approve/reject workflow with notifications, linkable to opportunity/project/contract |
| **Notifications** | ✅ Solid | 9 trigger types, bell with unread polling, paginated `/notifications` page, opt-in daily digest worker (local only) |
| **Audit log** | ✅ Solid | Global `AuditService` injected into 8+ services, `/admin/audit` viewer with filters by resource/user/date, embeddable `AuditTrail` component on detail pages |
| **PMO Dashboard** | ✅ Solid | Quick counts, RAG breakdown, gate distribution, blocker triage, pending approvals, contract cash position, recent activity feed |
| **Reports** | ✅ Solid | Pipeline + project portfolio + commercial position + recent activity sections, with CSV export on key tables |
| **Saved Views** | 🟡 Built but only wired into 1 list page | Backend supports any `module`; UI bar dropped into `/contracts` only |

---

## 4. What is partially built or unverified

| Area | What I see |
|---|---|
| **Procurement UI** | 611-line `/procurement` page exists. Vendors + POs are confirmed. Deliveries / RFQs UI not verified. |
| **Dashboard** (the role-agnostic landing page, not PMO) | 460 lines, predates the new contracts/audit data; not refreshed to surface new metrics |
| **Search module** | Backend `search.service.ts` exists; no global search bar in topbar to consume it |
| **Gates module** | Separate `gates` module on backend (in addition to gate logic inside ProjectsService); not 100% clear what each owns |
| **AI module** | Stub backend (`ai.service.ts` returns `[]`); `@solaroo/ai-prompts` package reserved for prompt templates; `@anthropic-ai/sdk` installed in API but unused |

---

## 5. What is stub-level (essentially placeholder code)

| Area | Evidence |
|---|---|
| **O&M module (frontend)** | `/om/page.tsx` is 15 lines. Renders a heading + a comment that says `{/* AssetFleetOverview + TicketQueue + MaintenanceDue will go here */}` |
| **Maintenance service** | 16 lines. `findAll` returns `[]`. `findById` returns `null`. |
| **Assets service** | 16 lines. Same pattern. |
| **Activities** | `Activity` model exists in Prisma schema. No service, controller, or UI surfaces it anywhere. The CRM cannot record a "called the customer today" log entry. |

This is exactly the same pattern the Contracts module had before this session (16-line stub). Rebuilding it follows a well-rehearsed playbook.

---

## 6. Significant features completely missing

| Gap | Impact |
|---|---|
| **Mobile-responsive layouts** | CLAUDE.md explicitly requires this for site team (site diary, photo upload, punch list, commissioning checklist). The actual UI is desktop-first. SITE_SUPERVISOR is a daily user but cannot work on a phone. |
| **Email notifications** | All notifications are in-app only. `@anthropic-ai/sdk`, AWS S3, and `resend` are installed in API package.json but not wired up. Daily digest fires in-app — never emails. |
| **File attachments on activities / messages** | Documents work but only as standalone records — not as inline attachments on an activity log entry or comment thread. |
| **Comment threads** | No way to discuss a record. Audit trail captures actions; no `comments` model. |
| **Bulk actions on lists** | No multi-select + bulk archive/delete/assign anywhere. |
| **CSV export on most lists** | Only `/reports` has CSV export. List pages don't. |
| **Dashboard widgets sourced from real audit/contract data** | Was on the V1 pending list. Still not done. |
| **Notification mute/preferences per type** | The only notification preference today is the daily-digest on/off toggle. |
| **Team management UI** | `Team` + `TeamMember` models exist in schema; no UI. |
| **Worker on Railway** | Worker exists in `services/worker/` and runs locally with the digest job. Not deployed to Railway. Production has zero digest functionality. |
| **Demo fixture data** | Seed creates roles + users only. No sample opportunities/projects/contracts. Production DB is empty for deal-flow records — users see "No projects yet" everywhere. |
| **Storage backend for production uploads** | Local dev writes uploads to `uploads/` on disk. Railway containers are ephemeral — uploaded files would be lost on redeploy. AWS S3 SDK is installed but the upload service writes to local disk unconditionally. |

---

## 7. What this session built (for context on velocity)

Started as: stub Contracts module, no Audit, no Saved Views, no PMO widgets, no Reports page, no daily digest, no document approve/reject UI, no per-gate audit, broken login on production, no contract/document linkage.

Ended as: everything in Section 3 above. **70 files changed, +7081 / −85 lines, 4 commits to main, 5 Railway redeploys, 1 onboarding Word doc, 2 dev logs.**

Single working session, single developer (with AI assistance). The honest bottleneck wasn't writing code — it was the schema-push / dev-restart cycle on Windows + OneDrive (Prisma engine file lock takes 2-3 dev restarts to apply each schema change; documented in `dev_log_260418.txt`).

---

## 8. Production deployment state

- **Web:** `https://web-production-d3322.up.railway.app` ✅ live, current commit
- **API:** `https://api-production-87a9.up.railway.app` ✅ live, current commit
- **PostgreSQL:** Railway managed instance, schema in sync, 268 permissions seeded
- **Redis:** Service was created on Railway but never actually deployed. `REDIS_URL` env var is set on the API service but no code uses it. Dead config.
- **Worker:** Not deployed to Railway. Runs locally only.
- **Production DB content:** 14 users, 14 roles, 268 permissions, 2 accounts, 2 contacts, 4 sites, **0 opportunities/proposals/contracts/projects**. The dev DB has data; production has none because we did `prisma db push --force-reset` early in the session to fix a stale-migration issue.
- **Railway plan:** Hobby ($5/mo). Shared CPU. Today we observed ~12s/request from edge (Fastly Kuala Lumpur PoP) → origin (Singapore region) on EVERY API call regardless of payload — confirmed not our code (even 404s and bad-JSON 400s took 12s). Was likely a transient Railway/Fastly issue; user reports it has cleared.

---

## 9. Constraints + lessons we keep paying for

These are honest pain points the reviewer should factor into recommendations:

1. **Windows + OneDrive workspace.** Prisma engine `.dll.node` lock requires killing dev to regen client every schema push. EPERM errors during Next.js standalone build (workaround: pinned `entry`/`output.filename` in webpack.config.js). Long path issues are constant background noise.
2. **No Redis available.** Hobby plan doesn't include Redis. Anything BullMQ/queue-based requires either upgrading or workarounds (current digest uses `setInterval`).
3. **Single developer (with AI assistance).** No code review process, no CI test gating. Type-checks via `tsc --noEmit` are the only quality gate.
4. **Schema migrations done with `prisma db push`, not `prisma migrate`.** We hit a corrupted `_prisma_migrations` table early in the session and switched to `db push --force-reset` for production. Migrations folder exists in repo but isn't used. This means schema history isn't versioned — only the live shape is reproducible.
5. **The webpack-bundled production API and the tsc-watch dev API are tuned for different `entryFile` values in `nest-cli.json`.** Resolved by pinning webpack entry/output explicitly in `webpack.config.js`. Brittle — `nest build --webpack` once silently rewrote `nest-cli.json` mid-build, breaking dev. Documented but worth a reviewer's eye.
6. **`AUTHZ_ENFORCE` defaults to `false` (audit-only mode).** This means the permission guard logs but doesn't block. Production has it set to `false` today. **Critical to flip to `true` before opening to non-admin users**, otherwise every user can call every endpoint regardless of role.
7. **Local file storage for uploads.** Production needs S3 (AWS SDK is installed, never wired). Today's "upload signed contract PDF" flow on Railway will lose the file on next redeploy.
8. **No tests.** Jest is installed and configured; test files exist for some older modules; nothing that ran this session has tests. Test:rbac smoke script (`scripts/rbac-smoke.mjs` referenced from package.json) doesn't exist anymore (we deleted that whole folder of Railway debug scripts).

---

## 10. Honest gaps in the audit log + RBAC

- **`AUTHZ_ENFORCE=false` is the elephant.** Until this is `true` in production, every API call is "successful" regardless of permission. The audit log captures this, the guards run in audit-only mode, but no enforcement happens.
- **Audit only captures explicit `audit.record(...)` calls.** Field-level diffs on free-form text edits (e.g. updating a contract scope summary) are not captured. The reviewer should consider whether that matters.
- **`SUPER_ADMIN` has no business-data permissions by design** (only `user_admin`/`role_admin`). This is intentional but surprising — every demo session starts with a confused "why can't the admin see contracts?". Worth deciding: change the convention, or document it more visibly.
- **`Contract:edit (team)` granted to `SALES_MANAGER`** — but the service-layer scope check in `contracts.service.update()` doesn't enforce a `team` filter. Effectively SALES_MANAGER can edit any contract. Documented in dev log as a follow-up review item.

---

## 11. Schema summary (current state)

Prisma schema is split across files in `packages/db/prisma/schema/`:

- `auth.prisma` — User, Role, Permission, RolePermission, UserPermission, ProjectMember, OpportunityMember, Team, TeamMember
- `crm.prisma` — Account, AccountContact, Contact, Site, SitePhoto, Opportunity, OpportunityStageHistory, Activity, etc
- `proposals.prisma` — Proposal, ProposalVersion, ProposalAssumptionSet, ProposalApproval, SolutionOption, SiteSurvey, LoadProfile
- `contracts.prisma` — Contract (extended this session: handoverStatus, handoverChecklist, etc), ContractMilestone, Invoice, Budget
- `projects.prisma` — Project, ProjectGate, GateDeliverable, ProjectTeamAssignment (legacy), Milestone, Task, Issue, Risk, Rfi, Submittal, Variation, CommissioningTest, PunchlistItem
- `documents.prisma` — Document (extended: contractId), DocumentRevision, Transmittal, TransmittalItem
- `procurement.prisma` — Vendor, Product, RFQ, RFQItem, Quote, PurchaseOrder, PoLineItem, Delivery
- `om.prisma` — Asset, MaintenanceRecord, ServiceTicket, WarrantyClaim, MaintenancePlan
- `audit.prisma` — AuditLog, Notification, SavedView, Tag

**Schemas exist for everything in the lifecycle. The gaps are services + UI on top of those schemas, not the data model.**

---

## 12. Candidate next-stage work (with honest effort estimates)

These are the gaps I see, ordered by impact-per-effort. The reviewer should tell us which order to take.

| # | Work item | Effort | Why it matters |
|---|---|---|---|
| 1 | **Build O&M module** (Assets, Maintenance, Service Tickets, Warranty Claims) — full backend + frontend mirroring the Contracts pattern | 3–4h | Closes the entire post-commissioning lifecycle. Currently a stub. Three roles (OM_ENGINEER, COMMISSIONING_ENGINEER) have nothing to do in the CRM. Largest functional gap. |
| 2 | **Mobile-responsive layouts for SITE_SUPERVISOR pages** (site diary, punch list, photo upload) | 2h | CLAUDE.md explicitly requires this. Site team can't use the CRM in the field today. |
| 3 | **Demo fixture data script** — one-shot seed of the Tioman example from the onboarding doc | 30 min | Production DB is empty for deal-flow records. Without this, no one can actually see the CRM working in production. |
| 4 | **Activities module** (call/email/visit/note logging on accounts + opportunities) | 2h | Without this the CRM forgets every conversation that happens off-system. Schema exists; UI doesn't. |
| 5 | **Wire up email notifications via Resend** | 2h | All notifications are in-app today. Resend SDK is installed. Required for users who don't live in the CRM. |
| 6 | **Production file storage to S3** | 2h | Today's "upload signed contract PDF" loses the file on every Railway redeploy. AWS SDK installed; storage adapter needs to switch on `NODE_ENV`. |
| 7 | **Global search bar** (topbar + Cmd+K, results across accounts/contacts/opps/projects/contracts) | 2h | Backend `search` module exists; no UI. High daily-use value. |
| 8 | **Spread Saved Views to other list pages** (opportunities, projects, audit) | 30 min each | Component already built; literally a 5-line addition per list page. |
| 9 | **Worker deployment to Railway** | 1h | New Railway service; same `Dockerfile.api`-style build with worker target. Then digest actually runs in production. |
| 10 | **Set `AUTHZ_ENFORCE=true` in production** then audit every endpoint to make sure permissions don't accidentally over-restrict | 4-8h | The single biggest hidden risk. Today, audit mode means the permission guards log but don't block. Until this is flipped, RBAC is theatre. |
| 11 | **Add a real test suite** (start with rbac smoke + contracts handover state machine) | 6-10h | Zero tests today. As the codebase grows, regressions are inevitable. |
| 12 | **Comments / threaded discussion model** | 4h | Cross-cutting concern; relates to activities. Decide together. |

---

## 13. What we'd like ChatGPT to advise on

Concrete questions, ordered by what we most want a second opinion on:

1. **Sequence.** Of the 12 candidates above, what order maximises business value while keeping technical risk low? We're inclined toward `1 → 3 → 2 → 5` (O&M → demo data → mobile → email) but want a sanity check.

2. **`AUTHZ_ENFORCE=true` rollout.** Is the right approach to flip it in a staging environment first, then production? We don't have a staging environment today (one DB, one Web, one API). Worth standing one up before any non-admin user is given access?

3. **File storage.** If we move to S3, should we also switch local dev to use S3 (e.g. via MinIO container) or keep local-disk for dev and S3 for prod? The duality has tradeoffs.

4. **Worker deployment.** Stick with `setInterval` (simple, cheap, no Redis) or invest in Redis + BullMQ now (adds ~$5/mo for Redis on Railway, requires worker code rewrite, but unlocks proper scheduled/retry/queued job patterns). Today only the digest needs scheduling — but tomorrow there'll be email retries, async PDF generation, etc.

5. **Schema migration discipline.** We've been using `prisma db push` because `prisma migrate` got into a corrupted state early in the session. Should we (a) reset migration history, (b) commit to `db push` permanently for an internal-only single-tenant app, or (c) move to a proper migration workflow before more schema churn?

6. **Test investment.** Zero tests today. Where would adding tests bite least and protect most? RBAC smoke is the obvious candidate (one bug there = cross-user data leak). Beyond that?

7. **The 12s Fastly→Railway latency we observed today.** Was it really transient? If it recurs, is upgrading to Pro ($20/mo) the answer, or should we consider moving away from Railway entirely? Constraints: solo dev wants minimum ops overhead, and Railway has been ~80% painless apart from the deployment friction documented in dev logs.

8. **Demo fixture data.** Should it be (a) a one-shot script for production, (b) baked into `db:seed` so every reseed has it, or (c) a separate `db:seed:demo` script gated on a `LOAD_DEMO_DATA=true` env var? Production DB is currently empty.

9. **What we're NOT doing that we should be.** Anything in the lifecycle that's missing from the candidate list above? Anything we've over-engineered? Any modules that look risky based on this document?

---

## 14. Files for further reference

If ChatGPT wants to look deeper:

- `dev_log/dev_log_260418.txt` — honest blow-by-blow of the contracts + 10 follow-ups session (problems + decisions)
- `dev_log/Solaroo_RE_CRM_Onboarding.docx` — 24 KB user onboarding doc with full architecture + worked end-to-end example
- `CLAUDE.md` (repo root) — original project brief and architecture rules
- `docs/crm-workflow-and-role-matrix.md` — role matrix detail
- `packages/db/prisma/schema/*.prisma` — full data model
- `packages/db/src/seeds/permissions.seed.ts` — full permission grants per role

---

## 15. Tone / one-line summary

We have a working CRM that covers ~80% of the project lifecycle for ~80% of the user base. The remaining 20% is concentrated in O&M, mobile UX, RBAC enforcement, and production polish (email, storage, demo data, worker deployment). We want to ship the next slice in 1-2 focused sessions and would like the reviewer's read on which slice gives the most leverage.
