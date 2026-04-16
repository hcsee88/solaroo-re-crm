# PROJECT_ENGINEER Role — Definition & Access Reference

**Status:** Active  
**Owner:** Pekat Teknologi Sdn Bhd  
**Last updated:** 2026-04-15

---

## 1. Role Definition

The **Project Engineer** is an execution coordinator who works directly under the Project Manager. They are responsible for the day-to-day tracking of project deliverables, document coordination, issue and risk logging, and gate submission preparation. They do not make commercial decisions and do not have approval authority over gates, proposals, or punch lists.

In V1, the Project Engineer is the person who keeps the project "administratively healthy" — ensuring documents are uploaded, milestones are recorded, issues are logged before they become blockers, and gate packages are prepared for the PM to review and submit.

---

## 2. Key Responsibilities

- Track and update project milestones and deliverable checklists
- Upload and revise project documents (drawings, submittals, reports)
- Log issues and risks on assigned projects — including owner and target resolution date
- Prepare gate submission packages for Project Manager review
- Coordinate with Design, Procurement, and Site teams on document status
- Monitor site logs, checklists, and punch lists on assigned projects (view + update, not approve)
- View purchase orders and deliveries to track material readiness
- Keep the gate deliverable checklist up to date so the PM can submit with confidence

---

## 3. Access / Authority Matrix

| Resource | View | Create | Edit | Submit | Approve | Notes |
|---|---|---|---|---|---|---|
| Contact | assigned | — | — | — | — | Reference only |
| Site | assigned | — | — | — | — | Reference only |
| Opportunity | assigned | — | — | — | — | Context only; no commercial data |
| Proposal | assigned | — | — | — | — | View status and scope only; no CAPEX or margin |
| Project | assigned | — | assigned | — | — | Edit project notes, RAG updates as delegated |
| Project Gate | assigned | — | assigned | assigned | **NO** | Prepares gate; PM approves |
| Milestone | assigned | assigned | assigned | — | — | Full milestone management |
| Issue | assigned | assigned | assigned | — | — | Log and update issues |
| Risk | assigned | assigned | — | — | — | Log risks; PM edits/owns |
| Document | assigned | assigned | assigned | assigned | **NO** | Full doc coordination; Design Lead/PM approves |
| Drawing | assigned | — | — | — | — | View reference drawings only |
| Vendor | all (ref) | — | — | — | — | Read-only vendor reference |
| Purchase Order | assigned | — | — | — | — | View to track material delivery status |
| Delivery | assigned | — | — | — | — | View to track receipt status |
| Site Log | assigned | — | — | — | — | View site diary for project context |
| Checklist | assigned | — | — | — | — | View construction checklists |
| Punch List | assigned | — | assigned | — | **NO** | Update punch items; CE/PM approves |
| Reporting | assigned | — | — | — | — | Project-scoped reporting view |

**Scope:** All access is scoped to `assigned` — projects where the Project Engineer is explicitly a member.

---

## 4. What PROJECT_ENGINEER Must NOT See or Do

| Restricted | Reason |
|---|---|
| Pipeline value / CAPEX / Margin % | Commercial sensitivity — Sales + Director only |
| Proposal CAPEX and margin fields | Same as above |
| Contract value / payment status | Finance restricted — Finance Admin + Director only |
| Project budget baseline / actual cost | Cost:view restricted to Director, Finance Admin, PM |
| Opportunity create / edit | No sales authority |
| Proposal create / edit / approve | No commercial authority |
| Gate approve | Approval authority belongs to PM and Director only |
| Punch list approve | Approval authority belongs to PM and CE |
| User management / admin | SUPER_ADMIN exclusive |
| Other users' projects | Scope is `assigned` — cannot see projects they are not a member of |

---

## 5. Difference vs Other Roles

### PROJECT_ENGINEER vs PROJECT_MANAGER

| Dimension | Project Manager | Project Engineer |
|---|---|---|
| Gate approval authority | Can approve (assigned scope) | Cannot approve — submit only |
| RAG status ownership | Sets and owns RAG | Updates as delegated by PM |
| Commercial visibility | Sees budget baseline, cost to date | Cannot see cost or budget fields |
| Contract / invoice | View assigned contracts | No contract access |
| Risk ownership | Owns and edits risks | Can log risks, cannot edit |
| Milestone authority | Full milestone ownership | Full milestone create/edit |
| Reporting | Project-scoped with cost | Project-scoped, no cost |

### PROJECT_ENGINEER vs DESIGN_ENGINEER

| Dimension | Project Engineer | Design Engineer |
|---|---|---|
| Primary focus | Delivery tracking, gate coordination, docs | Technical design, drawings, DBDs |
| Drawing authority | View only | Create, edit, submit drawings |
| Issue/Risk creation | Yes | Yes |
| Gate involvement | Prepares and submits gate packages | View gates only |
| Milestone management | Full create/edit | View only |
| Opportunity access | View assigned | View assigned |

### PROJECT_ENGINEER vs SITE_SUPERVISOR

| Dimension | Project Engineer | Site Supervisor |
|---|---|---|
| Primary focus | Administrative coordination, gate prep | Physical site execution, daily diary |
| Site log authority | View only | Create and edit site logs |
| Checklist authority | View only | Create and edit checklists |
| Document upload | Yes — full doc coordination | Yes — site documents |
| Gate / milestone | Full (submit, create, edit) | No gate access |

---

## 6. Recommended UI / Workspace for PROJECT_ENGINEER

### Sidebar navigation
```
Dashboard
Projects
Documents
```

### Dashboard view (what PROJECT_ENGINEER sees)
- **Project Health section** — assigned projects by RAG status, gate progress, overdue deliverables
- **Quick counts** — active projects (assigned only), open issues, overdue milestones
- Does NOT see: pipeline value, proposal section, accounts count, sales metrics

### Project detail page
Full access to all project sub-sections: gate tracker, milestones, issues, risks, documents, site logs (view), checklists (view), punch list (view + update).

No visibility of: budget baseline, cost to date, contract section.

### Documents page
Full document list scoped to assigned projects. Can upload, edit metadata, submit for approval. Revision history visible. Cannot approve.

### What is hidden from the role
- Proposals: visible (status only) but CAPEX and margin columns stripped server-side
- Opportunities: visible (project context only) but estimated value stripped server-side
- Accounts / Contacts / Sites: accessible via direct link from project but not in sidebar nav
- All finance screens: not in nav, no backend permission

---

## 7. Implementation Notes

### Scope enforcement
All resources use `scope: 'assigned'`. In the backend:
- `project`: member check via `ProjectMember` table (where `userId = user.id`)
- `document`: member check via project or opportunity membership
- `issue/risk/milestone/gate`: resolved via the parent project's assigned scope

### Sensitive field stripping
`margin:view_estimated` — NOT granted. API will return `null` for:
- `proposal.latestVersion.estimatedCapex`
- `proposal.latestVersion.marginPercent`
- `opportunity.estimatedValue` (hidden in column)

`cost:view` — NOT granted. API will return `undefined` / stripped for:
- `project.budgetBaseline`
- `project.actualCostToDate`
- `project.marginBaseline`

### How to add a Project Engineer to a project
The SUPER_ADMIN or Project Manager assigns them via `ProjectMember` record. Until assigned, they see no projects. This is identical to how other assigned-scope roles (DESIGN_ENGINEER, PROCUREMENT) work.

---

## 8. Seeded Test User

| Field | Value |
|---|---|
| Email | projectengineer@pekatgroup.com |
| Password | Test@1234 |
| Role | PROJECT_ENGINEER |
| Status | Active (deactivate before production) |

---

## 9. Open Questions / Future Considerations

| Item | Status |
|---|---|
| Should PROJECT_ENGINEER be able to create site logs when on-site? | Deferred — considered post-V1. Site Supervisor owns site diary for now. |
| Should PROJECT_ENGINEER see cost data on their own projects? | No — this is a deliberate restriction. Cost visibility is PM + Finance only. |
| Should PROJECT_ENGINEER be able to create risks (not just log issues)? | Currently: can create risks (logging), cannot edit after creation. Review at V1 adoption. |
| OpportunityMember assignment UI | Deferred to post-V1. Currently assigned via DB or admin action. |
| Multiple Project Engineers per project | Supported by ProjectMember table — no limit. |
