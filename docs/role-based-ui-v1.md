# Role-Based UI — V1 Direction

**Date:** 2026-04-13  
**Status:** Implemented  
**Source of truth:** `apps/web/src/lib/role-ui.ts`

---

## Design Principle

Permission to access an endpoint ≠ permission to show every field or module.

The backend `AUTHZ_ENFORCE=true` controls **API access**. The role-based UI layer controls **what is shown** within the frontend. Both layers are needed:

- The backend blocks unauthorized API calls (403)
- The frontend prevents visual clutter, accidental data exposure, and role confusion

Default posture: **show less, not more**. A role sees only what is relevant to their daily work. Sensitive commercial data is hidden unless the role genuinely needs it.

---

## Sidebar Navigation by Role

| Role | Sidebar items |
|---|---|
| SUPER_ADMIN | Admin / User Management only (no business nav) |
| DIRECTOR | Dashboard · Opportunities · Proposals · Projects · PMO · Documents · Reports |
| PMO_MANAGER | Dashboard · Projects · PMO · Documents · Reports |
| SALES_MANAGER | Dashboard · Accounts · Contacts · Sites · Opportunities · Proposals · Documents · Reports |
| SALES_ENGINEER | Dashboard · Accounts · Contacts · Sites · Opportunities · Proposals · Documents |
| PROJECT_MANAGER | Dashboard · Projects · PMO · Documents · Reports |
| DESIGN_LEAD | Dashboard · Opportunities · Proposals · Projects · Documents · PMO · Reports |
| DESIGN_ENGINEER | Dashboard · Opportunities · Projects · Documents |
| PROCUREMENT | Dashboard · Projects · Procurement · Documents |
| SITE_SUPERVISOR | Dashboard · Projects · Documents · O&M |
| COMMISSIONING_ENGINEER | Dashboard · Projects · Documents · O&M |
| OM_ENGINEER | Dashboard · O&M · Projects · Documents |
| FINANCE_ADMIN | Dashboard · Reports · Projects · Documents |

**Design rationale:**
- Director does not need Accounts/Contacts/Sites/Procurement in the primary nav — he operates at the management signal level
- PMO only needs the portfolio view, not the sales workflow
- Sales Engineer does not get Reports — reporting is for managers and above
- Execution roles (Site, Commissioning, O&M) see no commercial modules
- Finance sees Reports and Projects for context, not the full sales pipeline

---

## Column Visibility Rules

### Proposals List (`/proposals`)

| Column | Roles that see it |
|---|---|
| Code | All |
| Title | All |
| Opportunity | All |
| Account | All |
| Status | All |
| **CAPEX** | DIRECTOR, SALES_MANAGER, FINANCE_ADMIN only |
| **Margin %** | DIRECTOR, SALES_MANAGER, FINANCE_ADMIN only |
| Versions | All |

**Why CAPEX is hidden from most roles:**  
Design Engineers, Project Managers, and PMO need to work with proposals as documents (review, approve workflow, track versions). They do not need the raw commercial figure to do their job.

**Why Margin is the most restricted:**  
Margin is the most commercially sensitive field in the system. Even roles like DESIGN_LEAD and SALES_ENGINEER who regularly interact with proposals do not see margin by default in V1.

### Opportunities List (`/opportunities`)

| Column | Roles that see it |
|---|---|
| Code | All |
| Title | All |
| Stage | All |
| Next Action | All |
| Account | All |
| **Value (RM)** | DIRECTOR, SALES_MANAGER, SALES_ENGINEER, FINANCE_ADMIN only |
| Owner | All |

**Why Value is hidden from execution roles:**  
Project Managers, Design Engineers, Procurement, Site Supervisors, Commissioning, and O&M Engineers access opportunities for context (linked project, linked site). They do not need to see the deal value to do their work.

---

## Dashboard Section Visibility

The dashboard uses a single API response (`GET /reporting/dashboard`). Sections are rendered conditionally by role — no separate API calls needed.

| Section | Visible to |
|---|---|
| Quick count — Active Accounts | DIRECTOR, SALES_MANAGER, SALES_ENGINEER, FINANCE_ADMIN |
| Quick count — Active Opportunities | DIRECTOR, SALES_MANAGER, SALES_ENGINEER |
| Quick count — Active Projects | All roles |
| Quick count — Proposals Pending | DIRECTOR, SALES_MANAGER, SALES_ENGINEER, DESIGN_LEAD, FINANCE_ADMIN |
| **Pipeline Health section** | DIRECTOR, SALES_MANAGER, SALES_ENGINEER |
| **Pipeline Value figure** | DIRECTOR, SALES_MANAGER only |
| Stage breakdown value column | DIRECTOR, SALES_MANAGER only |
| **Proposal Status section** | DIRECTOR, SALES_MANAGER, SALES_ENGINEER, DESIGN_LEAD, FINANCE_ADMIN |
| **Project Health section** | All roles |
| Red project blockers detail | All roles |

**Key decisions:**
- Execution roles (Project Manager, Design Engineer, Procurement, Site, Commissioning, O&M) see a focused dashboard: Active Projects quick count + Project Health. No sales noise.
- FINANCE_ADMIN sees proposals pending (for invoice milestone context) but not the pipeline section.
- Sales Engineer sees pipeline but not pipeline RM value.
- PMO_MANAGER sees the full project health section plus proposals pending count.

---

## Sensitive Data Presentation Rules

| Field | V1 Rule |
|---|---|
| Proposal Margin % | Hidden in list view for all roles except DIRECTOR, SALES_MANAGER, FINANCE_ADMIN |
| Proposal CAPEX | Hidden in list view for all roles except DIRECTOR, SALES_MANAGER, FINANCE_ADMIN |
| Opportunity Value | Hidden in list view for execution roles; visible to sales + finance + director |
| Pipeline Value (dashboard) | Shown only to DIRECTOR and SALES_MANAGER |
| Stage value breakdown | Shown only to DIRECTOR and SALES_MANAGER |
| Contract value | Backend-controlled (contract:view permission), not yet surfaced in list views |
| Invoice amounts | Backend-controlled (invoice_milestone:view permission) |

**These rules apply to list/table views only.** Detail pages may show more fields based on what the backend returns — detail page field-level control is a V2 consideration.

---

## What is Intentionally Hidden by Default in V1

1. **Accounts, Contacts, Sites from Director's sidebar** — Director operates at management level. If needed, pages are still accessible by URL.
2. **PMO from Sales roles** — Sales Engineer and Sales Manager do not need the PMO portfolio view.
3. **Procurement from Design, Sales, and O&M roles** — procurement workflow is not part of their job.
4. **Reports from Sales Engineer** — reporting is for managers and above in V1.
5. **CAPEX and Margin from proposals list** — almost all roles (except DIRECTOR, SALES_MANAGER, FINANCE_ADMIN) see proposals without commercial figures.
6. **Deal value from opportunities list** — execution roles access opportunities for project context only.
7. **Pipeline section from execution roles' dashboard** — Project Manager, Design Engineer, Procurement, Site, Commissioning, O&M see project health only.

---

## Implementation Details

**Central config:** `apps/web/src/lib/role-ui.ts`  
All rules are defined once here. No rules scattered across individual components.

**Hooks:**  
- `useRoleName()` in `hooks/use-current-user.ts` — returns current role name string
- All helper functions are pure functions in `role-ui.ts` — `getNavItemsForRole()`, `canSeeProposalCapex()`, `canSeeProposalMargin()`, `canSeeOpportunityValue()`, `canSeePipelineSection()`, etc.

**Sidebar:**  
`components/layout/sidebar.tsx` — imports `getNavItemsForRole()` and filters the master nav list. Zero duplication.

**Pages updated:**
- `proposals/page.tsx` — CAPEX + Margin columns conditional
- `opportunities/page.tsx` — Value column conditional
- `dashboard/page.tsx` — Pipeline section, Proposal section, quick counts conditional

---

## V2 Candidates (Not Built Yet)

- Detail page field-level hiding (margin in proposal detail, cost in project detail)
- Role-appropriate empty states ("You have no assigned projects" vs generic empty)
- Action button hiding by role (e.g. hide "New Proposal" for Design Engineer)
- Role-specific dashboard widgets (e.g. maintenance tickets widget for O&M Engineer)
- Mobile-optimized views for Site Supervisor and Commissioning Engineer
