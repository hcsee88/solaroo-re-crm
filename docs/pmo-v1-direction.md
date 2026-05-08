# PMO V1 Direction — Solaroo RE CRM

**Document date:** 2026-04-11  
**Last reviewed:** 2026-05-08  
**Status:** Adopted — implemented in V1  
**Author:** Architecture / Product (Pekat Teknologi Sdn Bhd)

> **2026-05-08 update:** PMO V1 is in place and stable. The current next-module priority sits **upstream** of PMO — it's **Sales Pipeline Monitoring V1** (manual activity logging, next-action discipline, opportunity health, sales pipeline dashboard). PMO continues to consume data from CRM unchanged; the new sales-discipline data simply gives PMO a clearer "what's coming downstream" view via the existing reporting surface. See `docs/v1-product-direction.md` for the Sales Pipeline V1 scope. O&M remains deferred.

---

## 1. PMO Operating Model in V1

PMO in Solaroo RE CRM V1 is a **thin governance layer**, not a separate system. It lives inside the CRM as a read-mostly, cross-portfolio visibility role. The intent is to give one or two designated PMO managers a consolidated view of every active project's health — without duplicating data, adding bureaucratic overhead to PMs, or creating a separate PMO tool.

**Core principle:** The CRM is the system of record. PMO consumes data from it; PMO does not own the data.

### What PMO does in V1

| Activity | How it works in the CRM |
|---|---|
| Portfolio health monitoring | `GET /reporting/pmo` — aggregated dashboard with RAG breakdown, gate distribution, blockers, overdue items |
| Gate governance | PMO can flag gates (`pmoFlagged`), leave review comments (`pmoComment`), and approve/reject gate submissions |
| Blocker tracking | PMs set `currentBlocker`, `blockerDueDate`, `blockerOwner` on Project — PMO sees all active blockers in the PMO dashboard |
| Milestone drift detection | `baselineDate` (frozen at commitment) vs `targetDate` (current forecast) allows PMO to detect schedule drift without PM intervention |
| Issue escalation visibility | PMO sees all CRITICAL/HIGH severity issues across the portfolio |
| Stalled project detection | Projects with `updatedAt` > 14 days ago are surfaced automatically in the PMO dashboard |
| Portfolio status notation | PMO can write `pmoStatusNote` and `lastPmoReviewAt` on a Project record to record their latest governance assessment |

### What PMO does NOT do in V1

- PMO does not own project data — PMs own their project records
- PMO does not create or edit proposals, contracts, or commercial data
- PMO does not set RAG status — only the PM sets RAG
- PMO does not create milestones, issues, or risks (view + note only in V1)
- PMO does not replace Finance or the Director on financial close-out
- PMO does not manage procurement or vendor relationships
- PMO is not a project manager — no task assignment, no resource management

---

## 2. Role-by-Role Visibility Matrix

### Who sees the PMO Dashboard (`/pmo`)

The PMO page is accessible to any role with `reporting:view` permission. In practice the key consumers are:

| Role | PMO Dashboard Access | Notes |
|---|---|---|
| PMO Manager | Full — all sections | Primary audience |
| Director | Full — all sections | Executive visibility |
| Sales Manager | Full | For pipeline/proposal section context |
| Design Lead | Full | Cross-project design visibility |
| Project Manager | Not primary audience — use project detail pages | Can see own project health there |
| All others | No `reporting:view` — no PMO page access | — |

### PMO Manager role permissions summary

**Can view (all projects, cross-portfolio):**
- Accounts, Sites (read-only context)
- Opportunities, Proposals, Proposal Versions (read-only commercial context, no margin)
- Projects — all fields except financial close-out
- Gates, Milestones, Issues, Risks, RFIs
- Documents, Drawings (view + export)
- RFQs, Purchase Orders (view only — no edit, no approval)
- Reporting (all reporting endpoints + export)

**Can edit (governance actions only):**
- Gate: `pmoFlagged`, `pmoComment`, `pmoReviewAt` (PMO review fields)
- Gate: approve or reject a SUBMITTED gate (`project_gate:approve:all`)
- Project: `pmoStatusNote`, `lastPmoReviewAt` (PMO assessment fields)
- Milestone: create and edit (baseline management)
- Issue: create and edit (escalation flagging)
- Risk: create and edit (portfolio risk notes)

**Cannot access:**
- Contracts and contract milestones
- Invoices and payment status
- Budget, cost, and margin data
- Financial close-out records
- User Management / Admin

---

## 3. Sensitive Data Visibility Rules

The following fields and resources carry commercial or financial sensitivity. Access is restricted regardless of PMO's portfolio governance scope.

| Data | PMO Manager sees it? | Who does see it |
|---|---|---|
| `estimatedValue` on Opportunity | No (view access exists, but field is included in the select — acceptable at proposal stage) | Director, Sales Manager, Sales Engineer (own) |
| Proposal `totalPrice`, `marginPercent` | No — PMO has proposal:view but margin is a filtered field | Director, Sales Manager only |
| Contract `contractValue`, `retentionPercent` | No | Director, Sales Manager, Finance/Admin |
| Invoice amounts, payment dates | No | Finance/Admin, Director |
| Budget baseline, cost updates, EAC | Project-level `budgetBaseline` is visible in project detail; detailed cost breakdowns are not | Director, Finance/Admin |
| Equipment serial-level costs | No | Procurement, Director |

> **Implementation note:** Margin and invoice filtering is currently enforced at the query/field level per endpoint. The `reporting:view` permission grants access to the PMO metrics endpoint which does not expose any commercial figures — it aggregates counts, dates, RAG statuses, and text fields only.

---

## 4. PMO Role Recommendation

**Decision: Dedicated `PMO_MANAGER` role (Option B)**

Rationale for rejecting alternatives:
- **Adding to DIRECTOR**: Director already has all access — PMO is about governance workflow, not executive sign-off. Mixing these dilutes accountability.
- **Adding to PROJECT_MANAGER**: PM has own-project scope by design. PMO requires cross-portfolio (`all`) scope on every project. Giving this to PM would collapse the intended data separation.
- **Making it a team permission**: The permission system currently does not support per-team overrides on `all`-scoped permissions cleanly enough for V1.

`PMO_MANAGER` is seeded as a first-class role. Test user: `pmo@pekatgroup.com` / `Test@1234`.

---

## 5. Minimum PMO Data / Field Requirements

These are the fields added to the schema specifically for PMO governance in V1. All other PMO visibility comes from existing project fields.

### Project model additions

| Field | Type | Purpose |
|---|---|---|
| `pmoStatusNote` | `String?` | PMO's latest governance assessment narrative for this project |
| `lastPmoReviewAt` | `DateTime?` | Timestamp of the last formal PMO review |

### ProjectGate model additions

| Field | Type | Purpose |
|---|---|---|
| `pmoFlagged` | `Boolean` (default false) | PMO has flagged this gate as requiring attention |
| `pmoComment` | `String?` | PMO's review comment on the gate submission |
| `pmoReviewAt` | `DateTime?` | When PMO last reviewed this gate |

### Milestone model addition

| Field | Type | Purpose |
|---|---|---|
| `baselineDate` | `DateTime?` | Original committed date — frozen at baseline, never changed. Allows drift calculation vs `targetDate` |

### What was NOT added (intentional exclusions)

- No `escalationFlag` or `escalationOwner` on Issue — PMO can see severity; explicit escalation field deferred to V2
- No `GatePmoStatus` enum — PMO approval uses the existing gate `status` field (SUBMITTED → APPROVED/REJECTED)
- No `pmoApprover` foreign key on Gate — gate approver is tracked via audit log, not a dedicated field in V1
- No separate PMO note/log model — `pmoStatusNote` is a simple text field; structured review history deferred to V2

---

## 6. PMO Dashboard Requirements

The PMO portfolio page is at `/pmo`. It is served by `GET /reporting/pmo`.

### Quick Count cards (8)

1. Total Active Projects
2. RED Projects (RAG)
3. Projects with Blocker
4. Gates Pending Approval
5. Overdue Deliverables
6. Overdue Milestones
7. Critical / High Issues
8. Proposals Pending Approval

### Sections

| Section | Data source | Threshold / filter |
|---|---|---|
| RAG Health Bar | `ragBreakdown` | GREEN / AMBER / RED counts, % breakdown |
| Gate Distribution | `gateDistribution` | Count of active projects at each gate G1–G6 |
| Pending Gate Approvals | `pendingGateApprovals` | Gates with `status = SUBMITTED` on ACTIVE projects |
| Active Blockers | `projectsWithBlocker` | ACTIVE projects where `currentBlocker IS NOT NULL`; ordered RAG asc, `blockerDueDate` asc |
| Overdue Deliverables | `overdueDeliverables` | Required PENDING deliverables on IN_PROGRESS gates where `gate.targetDate < now` |
| Overdue Milestones | `overdueMilestones` | Milestones where `isComplete = false` and `targetDate < now` on ACTIVE projects |
| Critical / High Issues | `criticalOpenIssues` | Issues with `status IN (OPEN, IN_PROGRESS)` and `severity IN (CRITICAL, HIGH)` |
| Stalled Projects | `stalledProjects` | ACTIVE projects with `updatedAt < 14 days ago` |

### API endpoint

```
GET /reporting/pmo
Permission required: reporting:view
```

Response shape: `{ quickCounts, ragBreakdown, gateDistribution, projectsWithBlocker, pendingGateApprovals, overdueDeliverables, overdueMilestones, stalledProjects, criticalOpenIssues, generatedAt }`

---

## 7. What Was Built in V1 (Implementation Summary)

| Deliverable | Status |
|---|---|
| `PMO_MANAGER` role in seed | Done |
| PMO_MANAGER permission set in `permissions.seed.ts` | Done |
| Test user `pmo@pekatgroup.com` | Done |
| Schema: `pmoStatusNote`, `lastPmoReviewAt` on Project | Done |
| Schema: `pmoFlagged`, `pmoComment`, `pmoReviewAt` on ProjectGate | Done |
| Schema: `baselineDate` on Milestone | Done |
| DTO updates for PMO fields in `projects.dto.ts` | Done |
| Service: PMO gate fields saved in `updateGateStatus()` | Done |
| Reporting service: `getPmoMetrics()` method | Done |
| Reporting controller: `GET /reporting/pmo` endpoint | Done |
| Frontend: `/pmo` portfolio page | Done |
| Sidebar: PMO nav item with `ShieldCheck` icon | Done |
| Test User Credential.txt: PMO entry added | Done |

---

## 8. What is NOT Built Yet (V2 Candidates)

These items were deliberately excluded from V1 to keep scope tight.

| Item | Reason deferred |
|---|---|
| PMO gate approval action from the `/pmo` UI | The `/pmo` page is read-only in V1; gate approval is done from the project detail. UI action buttons deferred to V2 |
| Structured PMO review history / log | `pmoStatusNote` is a single text field. A proper review log with timestamps per entry needs a junction table — V2 |
| Escalation management module | Issue escalation workflow (escalationOwner, escalationDueDate, escalation → director notifications) deferred to V2 |
| PMO-specific notifications | Alert when gate is submitted, blocker outstanding > N days, milestone approaching baseline — V2 |
| Baseline vs actual schedule comparison chart | Needs milestone history table; `baselineDate` field is the foundation — chart deferred to V2 |
| Portfolio Gantt or timeline view | Heavyweight — V2 or V3 |
| Resource capacity view | PM allocation across projects — not in scope for V1 |
| PMO report export (PDF/Excel) | `reporting:export` permission is assigned; actual export endpoint not yet built |

---

## 9. Governance Decisions Recorded

| Decision | Outcome |
|---|---|
| PMO as separate system vs CRM layer | CRM layer — single system of record |
| PMO role: dedicated role vs multi-role | Dedicated `PMO_MANAGER` role |
| Gate approval authority in PMO | Yes — PMO_MANAGER has `project_gate:approve:all` |
| Finance / commercial access for PMO | No — explicitly excluded |
| Margin visibility for PMO | No |
| PMO can create milestones/issues | Yes in V1 — needed for baseline setting and escalation notes |
| PMO can edit project RAG | No — RAG is owned by the PM |
| PMO creates or edits proposals | No |
| PMO dashboard as own page vs embedded in reporting | Own page at `/pmo` — makes it first-class in the nav |
