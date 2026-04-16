# Solaroo RE CRM — V1 Product Direction

**Status:** Active  
**Owner:** Pekat Teknologi Sdn Bhd  
**Last updated:** 2026-04-15

---

## What Solaroo RE CRM V1 Is

A focused internal CRM that gives management **live visibility** into where every prospect, proposal, and project stands — and flags what needs attention **before** it becomes a problem.

V1 is not a full ERP. It is a **sales + project discipline tool** that keeps the team honest and keeps management informed.

The three questions V1 answers at a glance:

1. **Where is every deal?** (pipeline stage, probability, owner, next action, expected close)
2. **Where is every proposal?** (draft, pending approval, approved, rejected)
3. **Where is every project?** (gate, RAG status, blocker, next milestone, who owns it)

---

## What V1 Is Not

- Not a full procurement system (backend exists, frontend deferred)
- Not a full document management platform (document upload works, full DMS deferred)
- Not a field operations tool (site diaries, photo uploads — deferred)
- Not an AI assistant (backend connected, UI deferred)
- Not an accounting or finance ERP
- Not a complex configuration or settings system
- Not a multi-company or SaaS platform (single-company, internal only)

---

## V1 Module Scope

### INCLUDED — Core, must work well

| Module | What It Must Do |
|--------|----------------|
| **Management Dashboard** | Live: pipeline value by stage, proposals pending approval, projects by RAG, overdue next actions, overdue deliverables |
| **Accounts** | Create, view, edit clients and prospects. See all linked opportunities. |
| **Contacts** | Create, view, edit contacts. Link to accounts. |
| **Sites** | Create, view, edit sites. Link to accounts and opportunities. |
| **Opportunities** | Full pipeline with stage discipline. Next action, next action due date, last status note mandatory in active stages. Show stale deals. |
| **Proposals** | Draft → Submit → Approve/Reject. Clear approval chain. Easy to create, easy to action. |
| **Projects** | Gate tracker (G1–G6). RAG status per project. Blocker capture. Deliverable checklist. |
| **Admin — User Management** | SUPER_ADMIN creates and manages users. Roles assigned at creation. |
| **Security** | Permissions enforced (AUTHZ_ENFORCE=true). COOKIE_SECRET validated. No open registration. Test users deactivated in production. |

### INCLUDED — Complete enough for V1

| Module | What Is Built | What Is Enough for V1 |
|--------|--------------|----------------------|
| **Documents** | Full V1 Document Control delivered: paginated list, search/filter, upload linked to project or opportunity, download, revision history dialog, scope-enforced access, project-aware docCode | ✅ V1 complete |
| **O&M / Tickets** | Backend done | Basic ticket creation and status tracking |
| **Notifications** | Backend stub | In-app notification records for: proposal submitted for approval, proposal approved/rejected, gate submitted for approval |

### DEFERRED — Not in V1

| Item | Why Deferred |
|------|-------------|
| **Contracts frontend** | Backend schema and service exist; no frontend pages in V1. Contract management is done outside the system until V2. |
| AI Copilot UI | Not needed for adoption; backend already connected |
| Technical Assessment module | Complex domain; defer until proposals flow is mature |
| Full procurement frontend | Low immediate demand |
| Email delivery (BullMQ worker) | Worker stub exists; wire up after V1 stabilises |
| Advanced reporting / analytics | Dashboard covers management needs for V1 |
| Fancy audit trail UI | Backend logs exist; no UI priority |
| Mobile-optimised site diary | Defer to field operations phase |
| Multi-approver proposals | Current 2-step (SM → Director) is sufficient |
| OpportunityMember UI | Assigned scope works via ownership for V1 |

---

## V1 Workflow Definitions

### Opportunity Workflow (Sales Discipline)

```
LEAD → QUALIFIED → DATA_COLLECTION → SITE_ASSESSMENT_PENDING
→ CONCEPT_DESIGN → BUDGETARY_PROPOSAL → FIRM_PROPOSAL
→ NEGOTIATION → CONTRACTING → WON / LOST / ON_HOLD
```

Every opportunity in QUALIFIED or later **must have**:
- Owner (set at creation, always visible)
- Next action (free text: what needs to happen next)
- Next action due date (when it must happen)
- Last status note (brief update, overwritten each time)

**Management flag:** Any opportunity where `nextActionDueDate` is in the past = **overdue**. Shown on dashboard.

### Proposal Workflow (Approval Discipline)

```
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED
                  ↘ REJECTED
                  ↘ RETURNED → DRAFT (revise and resubmit)
```

Dashboard always shows count of proposals SUBMITTED or UNDER_REVIEW.

### Project Workflow (Execution Discipline)

```
Gate 1 (Contract Handover) → Gate 2 (Design Freeze) → Gate 3 (Procurement Release)
→ Gate 4 (Site Execution) → Gate 5 (Commissioning) → Gate 6 (Financial Close)
```

Every active project **must have**:
- RAG status (GREEN / AMBER / RED) — set by Project Manager
- Current blocker (if AMBER or RED) — who owns it, when it's due
- Current gate and progress

**Management flag:** Any project with RAG = RED or AMBER = shown prominently on dashboard.

---

## V1 Role Behaviours

| Role | Primary V1 Experience |
|------|-----------------------|
| **Director / Management** | Dashboard-first: see pipeline value, pending approvals, RED/AMBER projects, overdue actions. Approve proposals. |
| **Sales Manager** | Opportunity pipeline: see all deals. First-step proposal approver. Flag stale deals. |
| **Sales Engineer** | Manage own opportunities. Draft proposals. Update next action after every interaction. |
| **Project Manager** | Gate tracker. Update RAG status and blockers weekly. Submit gate approvals. |
| **Design Engineer** | View assigned projects. Upload deliverables. Mark deliverables complete. |
| **Procurement** | View purchase orders and deliveries (basic). |
| **Finance Admin** | View contracts, invoices, payment status. |
| **Site Supervisor** | (V1: view project + gate status. Full site diary: post-V1) |
| **Commissioning Engineer** | Gate 5 deliverables, punch list, handover docs. |
| **O&M Engineer** | View assets. Create and update maintenance tickets. |
| **SUPER_ADMIN** | User management only. No operational access. |

---

## V1 Dashboard KPIs (Management View)

The dashboard must answer these questions immediately:

### Pipeline Health
- Total active pipeline value (RM) — sum of estimatedValue for non-LOST, non-WON
- Opportunities by stage (bar or count per stage)
- Count of opportunities where nextActionDueDate is overdue
- Count of opportunities with no update in 14+ days (stale)

### Proposal Status
- Count of proposals pending approval (SUBMITTED + UNDER_REVIEW)
- List of oldest pending proposals (name, age in days, waiting for whom)

### Project Health
- Active projects by RAG status (count: GREEN / AMBER / RED)
- Projects with RAG = RED listed by name with current blocker
- Projects with overdue gate deliverables

### Quick Counts (summary row)
- Active accounts
- Active opportunities
- Active projects
- Proposals pending approval

---

## V1 Security Requirements (Non-Negotiable)

Before any real user accesses this system:

1. **`AUTHZ_ENFORCE=true`** must be set in the server environment. The system will log a startup warning if it is not.
2. **`COOKIE_SECRET`** must not be the default value `"change-this-secret"`. The system will refuse to start in production if the default is detected.
3. **`JWT_SECRET`** must be set in environment (not a code default).
4. **Seeded test users** must be deactivated or have passwords changed before production access is given.
5. User creation is admin-only — no open registration endpoint exists.
6. Sensitive financial fields (margin %, contract value, payment status) must be stripped from responses for unauthorized roles before data is returned to the client.

---

## V1 Notification Requirements (Minimal)

In-app notification records (stored in DB) for:
- Proposal submitted for approval → notify designated approver
- Proposal decision recorded (APPROVED/REJECTED/RETURNED) → notify proposal creator
- Gate submitted for approval → notify Project Manager and Director
- Gate approved → notify Project Manager

Email delivery is deferred until BullMQ worker is implemented.

---

## V1 Design Principles

1. **Minimum required discipline, maximum visibility** — only ask for data management truly needs
2. **Exceptions first** — RED projects, overdue actions, and pending approvals must be immediately visible
3. **Fast updates** — a Sales Engineer must be able to update next action in 30 seconds
4. **Role-appropriate views** — users see what they need; management sees everything
5. **Simple screens** — no nested tabs where flat lists work; no modals where inline works
6. **Backend enforces rules** — the UI is friendly, the backend is strict

---

## What Signals a Healthy V1 Adoption

- Sales team updates next action after every customer contact
- Dashboard shows accurate pipeline value and stage distribution
- Proposals move through approval in <5 business days
- Project RAG status is updated weekly by Project Manager
- Management can answer "what is the state of our business?" from the dashboard alone
- No one is building shadow spreadsheets to answer questions that the CRM should answer

---

## Post-V1 Priorities (Not in Scope Now)

1. Email notifications (wire BullMQ worker)
2. OpportunityMember assignment UI (for shared deal ownership)
3. Full procurement frontend (RFQs, POs)
4. AI copilot UI (summarise opportunity, draft proposal text)
5. Technical assessment module (site survey, load profile, solution sizing)
6. Full document control UI (transmittals, revision approval workflow)
7. Mobile-optimised site diary for field teams
8. Advanced analytics and reporting
9. O&M predictive maintenance scheduling
