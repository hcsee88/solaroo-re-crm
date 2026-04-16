# V1 Scope and Data Control

**Status:** Active  
**Owner:** Pekat Teknologi Sdn Bhd  
**Last updated:** 2026-04-16

---

## Overview

This document describes how the Solaroo RE CRM enforces data visibility at the service layer — specifically:

1. **Scope enforcement** — which records a role can list and access
2. **Sensitive field stripping** — which financial fields are removed from responses based on role

Backend is the single authoritative enforcement point. The frontend may hide fields for UX reasons, but the backend will strip them regardless.

---

## 1. Scope Model

### 1.1 Scope Hierarchy

The system uses four scope levels, in descending breadth:

| Scope | Meaning |
|-------|---------|
| `all` | Can see every record in the system |
| `team` | Can see records owned by users with the same role (V1: treated as `all` in list queries — no Team model yet) |
| `assigned` | Can see records where they are the owner/manager, or are an explicit team member |
| `own` | Can only see records they personally created / own |

When a user has multiple scope permissions for the same resource:action (e.g., both `own` and `assigned`), the highest scope wins via `AuthzService.getBestScope()`.

### 1.2 Scope-to-WHERE Mapping

`AuthzService.getBestScope()` is called at the top of every list service method. The resulting scope drives a Prisma WHERE clause:

| Scope | WHERE clause applied |
|-------|---------------------|
| `all` | No filter |
| `team` | No filter (V1 — Team model deferred) |
| `assigned` | `OR: [ownerField = me, OpportunityMember, ProjectMember on linked project]` |
| `own` | `ownerField = me` |
| `null` | `ForbiddenException` thrown |

**Note on assigned scope:** Resources linked to a project (opportunities, proposals) now include a ProjectMember traversal path. This is required for PROJECT_ENGINEER who is assigned at project level via `ProjectMember`, not at opportunity level via `OpportunityMember`. Both paths are checked when `scope = assigned`.

### 1.3 Record-Level Access (findById)

After fetching a single record, `AuthzService.requirePermission()` is called with a `ScopeContext` containing:
- `ownerId` — the record's owner/creator user ID
- `projectId` / `opportunityId` — for `assigned` scope resolution via member tables

If the user's best scope does not cover that specific record, a 403 is thrown.

---

## 2. Scope Matrix by Resource

### 2.1 Opportunities

| Role | Scope | Effective Access |
|------|-------|----------------|
| DIRECTOR, PMO_MANAGER, DESIGN_LEAD, FINANCE_ADMIN | `all` | All opportunities |
| SALES_MANAGER | `team` | All (V1 — team = all for list) |
| SALES_ENGINEER | `own` | Only opportunities they own |
| PROJECT_MANAGER, PROJECT_ENGINEER, DESIGN_ENGINEER | `assigned` | Opportunities where they are owner, OpportunityMember, **or ProjectMember on the linked project** |

`findAll` assigned filter (opportunities.service.ts):
```
ownerUserId = me
OR opportunity.members.userId = me           (OpportunityMember)
OR opportunity.project.members.userId = me   (ProjectMember — PE path)
OR opportunity.project.projectManagerId = me (ProjectMember — PM path)
```

`findById` scope context passes both `opportunityId` and `projectId` so `scopeCoversRecord` can resolve either membership table.

### 2.2 Proposals

| Role | Scope | Effective Access |
|------|-------|----------------|
| DIRECTOR, PMO_MANAGER, DESIGN_LEAD, FINANCE_ADMIN | `all` | All proposals |
| SALES_MANAGER | `team` | All (V1 — team = all for list) |
| SALES_ENGINEER | `own` | Proposals they created |
| PROJECT_MANAGER, PROJECT_ENGINEER, DESIGN_ENGINEER | `assigned` | Proposals where they created it, are OpportunityMember, **or ProjectMember on the linked project** |

`findAll` assigned filter (proposals.service.ts):
```
createdByUserId = me
OR proposal.opportunity.members.userId = me                    (OpportunityMember)
OR proposal.opportunity.project.members.userId = me            (ProjectMember — PE path)
OR proposal.opportunity.project.projectManagerId = me          (ProjectMember — PM path)
```

### 2.3 Projects

| Role | Scope | Effective Access |
|------|-------|----------------|
| DIRECTOR, PMO_MANAGER, SALES_MANAGER, DESIGN_LEAD, FINANCE_ADMIN | `all` | All projects |
| PROJECT_MANAGER, DESIGN_ENGINEER, PROCUREMENT, SITE_SUPERVISOR, COMMISSIONING_ENGINEER, OM_ENGINEER | `assigned` | Projects where they are the project manager or a ProjectMember |

---

## 3. Sensitive Field Policy

### 3.1 Field-Level Permission Gates

Sensitive fields are defined in `apps/api/src/common/authz/sensitive-fields.ts`. Each field maps to a permission that must be held before the field value is returned. If the permission is absent, the field is set to `null` in the response (never omitted entirely — the key is always present).

| Field name | Required permission | Appears in |
|-----------|-------------------|-----------|
| `estimatedValue` | `margin:view_estimated` (any scope) | Opportunity list + detail |
| `marginPercent` | `margin:view_estimated` (any scope) | Proposal list + detail |
| `estimatedMargin` | `margin:view_estimated` (any scope) | Proposal detail |
| `estimatedCapex` | `margin:view_estimated` (any scope) | Proposal list + detail |
| `estimatedSavings` | `margin:view_estimated` (any scope) | Proposal detail |
| `paybackYears` | `margin:view_estimated` (any scope) | Proposal detail |
| `commercialSummary` | `margin:view_estimated` (any scope) | Proposal detail |
| `actualMarginPct` | `margin:view_actual` (any scope) | (future — post-V1) |
| `actualMarginValue` | `margin:view_actual` (any scope) | (future — post-V1) |
| `contractValue` | `contract:view_value` (any scope) | Contracts (deferred V1) |
| `budgetBaseline` | `cost:view` (any scope) | Project list + detail |
| `actualCostToDate` | `cost:view` (any scope) | Project detail |
| `marginBaseline` | `cost:view` (any scope) | Project detail |
| `paymentStatus` | `payment_status:view` (any scope) | Invoice milestones (deferred V1) |

### 3.2 Who Sees What

#### Opportunity deal value (estimatedValue)

Permission: `margin:view_estimated`

| Role | Scope | Sees opportunity estimatedValue? |
|------|-------|----------------------------------|
| DIRECTOR | `all` | ✅ Yes |
| SALES_MANAGER | `team` | ✅ Yes |
| FINANCE_ADMIN | `all` | ✅ Yes |
| SALES_ENGINEER | `own` | ✅ Yes (own opportunities only — already filtered by scope) |
| PROJECT_MANAGER | `assigned` | ❌ No — field deleted from response |
| PROJECT_ENGINEER | `assigned` | ❌ No — field deleted from response |
| PMO_MANAGER | `all` | ❌ No — field deleted from response |
| DESIGN_LEAD | `all` | ❌ No — field deleted from response |
| All others | — | ❌ No |

Rationale: execution roles work from project scope only. Deal size (pipeline RM value) is commercially sensitive and not needed for project delivery.

#### Proposal commercial fields (marginPercent, estimatedMargin, estimatedCapex, estimatedSavings, paybackYears, commercialSummary)

Permission: `margin:view_estimated`

| Role | Scope | Sees proposal commercial fields? |
|------|-------|----------------------------------|
| DIRECTOR | `all` | ✅ Yes |
| SALES_MANAGER | `all` | ✅ Yes |
| FINANCE_ADMIN | `all` | ✅ Yes |
| SALES_ENGINEER | `own` | ✅ Yes (own proposals only — already filtered by scope) |
| PROJECT_MANAGER | `assigned` | ❌ No — fields nulled in response |
| PROJECT_ENGINEER | `assigned` | ❌ No — fields nulled in response |
| DESIGN_ENGINEER | `assigned` | ❌ No |
| All others | — | ❌ No |

Note: `estimatedSavings` and `paybackYears` are gated alongside the explicit margin/capex fields because they economically imply CAPEX and margin context even without explicit figures. `commercialSummary` is free-text authored by Sales Engineers and routinely contains commercial figures inline.

#### Project cost fields (budgetBaseline, actualCostToDate, marginBaseline)

Permission: `cost:view`

| Role | Scope | Sees project cost fields? |
|------|-------|--------------------------|
| DIRECTOR | `all` | ✅ Yes |
| FINANCE_ADMIN | `all` | ✅ Yes |
| PROJECT_MANAGER | `assigned` | ✅ Yes (on their projects — already filtered by scope) |
| All others | — | ❌ No |

#### Dashboard pipeline value (totalPipelineValue, byStage[].totalValue)

Permission: `margin:view_estimated` (any scope)

| Role | Sees pipeline RM value? |
|------|------------------------|
| DIRECTOR, SALES_MANAGER, FINANCE_ADMIN | ✅ Yes |
| SALES_ENGINEER | ✅ Yes (though dashboard access is limited) |
| PROJECT_MANAGER, PMO_MANAGER, DESIGN_LEAD, and others | ❌ No — value shows as 0 |

---

## 4. Implementation Details

### 4.1 AuthzService

Located at `apps/api/src/common/authz/authz.service.ts`. The `AuthzModule` is `@Global()`, so `AuthzService` is available via constructor injection in any module without explicit imports.

Key methods used in service enforcement:

```typescript
// Determine highest scope user has for a resource:action
getBestScope(user, resource, action): Promise<Scope | null>

// Check if user has any permission for resource:action (optionally scoped to a record)
hasPermission(user, resource, action, scopeCtx?): Promise<boolean>

// Same as hasPermission but throws ForbiddenException on failure
requirePermission(user, resource, action, scopeCtx?): Promise<void>

// Strip all sensitive fields from an object the user cannot see
stripSensitiveFields(obj, user): Promise<Partial<T>>
```

### 4.2 Enforcement Points

| Service | findAll scope | findById record-check | Field stripping |
|---------|--------------|----------------------|----------------|
| `OpportunitiesService` | ✅ getBestScope → WHERE (incl. ProjectMember paths) | ✅ requirePermission (passes opportunityId + projectId) | ✅ `estimatedValue` deleted if no `margin:view_estimated` |
| `ProposalsService` | ✅ getBestScope → WHERE (incl. ProjectMember paths) | ✅ requirePermission (passes opportunityId + projectId) | ✅ `marginPercent`, `estimatedMargin`, `estimatedCapex`, `estimatedSavings`, `paybackYears`, `commercialSummary` nulled if no `margin:view_estimated` |
| `ProjectsService` | ✅ getBestScope → WHERE | ✅ requirePermission | ✅ cost fields null/deleted if no `cost:view`; edit field guard blocks restricted fields for non-privileged roles |
| `ReportingService` | N/A (aggregates) | N/A | ✅ pipeline RM values zeroed if no `margin:view_estimated` |

### 4.3 Enforcement NOT Applied

The following services do NOT yet have scope enforcement (acceptable for V1 — see rationale):

| Service | Reason acceptable |
|---------|------------------|
| `AccountsService` | Accounts are lookup data; Sales Engineers create own accounts and won't see others' due to ownerUserId on account |
| `ContactsService` | Low sensitivity; contacts reference accounts |
| `SitesService` | Sites are reference data linked to accounts |
| `ProcurementService` | Procurement roles are internal ops — all procurement users can see all procurement |
| `DocumentsService` | Documents already scoped to project/opportunity; list endpoint accepts projectId/opportunityId filter |

---

## 5. Contracts — V1 Deferral Decision

**Decision date:** 2026-04-15  
**Decision:** Contracts module frontend is DEFERRED from V1.

**Rationale:**
- Contract management workflow requires careful UI design (milestones, payment tracking, variation orders)
- Building a rushed contracts frontend risks data quality issues for commercial records
- The backend Prisma schema (`contracts.prisma`) and service stub exist and are stable
- No frontend pages, no sidebar navigation item for Contracts in V1

**What exists:**
- `packages/db/prisma/contracts.prisma` — full schema (contracts, milestones, invoices, budgets)
- Contracts permissions are seeded and correctly gate `contract:view_value` to DIRECTOR, FINANCE_ADMIN, SALES_MANAGER
- Backend service stub (not a full implementation)

**V2 plan:** Full contracts frontend with milestone tracking, invoice status, and payment capture integrated with project Gate 6 (Financial Close).

---

## 6. Security Guarantees

The following hold true for V1 with `AUTHZ_ENFORCE=true`:

1. **No unauthenticated access** — JwtAuthGuard on all controllers
2. **No unauthorized endpoint access** — RequirePermission decorator on all routes; PermissionGuard enforces at controller level
3. **No cross-scope list pollution** — `getBestScope()` + Prisma WHERE applied in every list method for opportunities, proposals, and projects; WHERE clauses traverse both `OpportunityMember` and `ProjectMember` paths so PROJECT_ENGINEER sees exactly what they are assigned to
4. **No unauthorized record access** — `requirePermission()` with ScopeContext enforced in every detail method; both `opportunityId` and `projectId` passed so `scopeCoversRecord` can resolve either membership table
5. **No commercial data leakage** — proposal margin/capex/savings/paybackYears/commercialSummary, opportunity estimatedValue, and project cost fields stripped at service layer before the response leaves the server; execution roles receive `null` for all these fields
6. **No pipeline RM leakage** — dashboard pipeline value zeroed for non-commercial roles
7. **No unauthorized project mutation** — `ProjectsService.update()` enforces a role-based field guard; PROJECT_ENGINEER is blocked from writing `projectManagerId`, `designLeadId`, `procurementLeadId`, `budgetBaseline`, `budgetUpdated`, `status`, `pmoStatusNote`, and `lastPmoReviewAt`; returns explicit 403 with field list

---

## 7. Post-V1 Hardening Items

The following improvements are planned for V2:

| Item | Description |
|------|-------------|
| Team model | Implement proper Team entity so `team` scope in list queries filters correctly (currently treated as `all`) |
| Accounts/Contacts/Sites scope | Apply same scope enforcement pattern to CRM entities |
| Field stripping via interceptor | Move `stripSensitiveFields()` to a response interceptor so it's applied automatically |
| OpportunityMember UI | Allow explicit assignment of users to opportunities (currently assigned scope only works via ownership) |
| Audit log on 403s | Record every ForbiddenException with user, resource, and record for security review |
