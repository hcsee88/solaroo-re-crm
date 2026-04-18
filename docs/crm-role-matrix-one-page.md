# CRM Role Matrix One Page

This is a compact management view of what each role is meant to do in the current CRM.

Legend:

- `A`: all
- `T`: team
- `O`: own
- `Asg`: assigned
- `-`: no practical access

## Summary Matrix

| Role | Main workspace | Core scope | Commercial | Project delivery | Procurement | Finance visibility / action | Approval authority | Main cannot do |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SUPER_ADMIN | Admin only | A admin | - | - | - | - | User / role admin only | Business operations |
| DIRECTOR | Full portfolio | A | Full sales and proposal control | Full project and gate control | Full | Full cost, margin, contract, payment | Broadest business approver | User / role admin |
| PMO_MANAGER | Projects, PMO, reports | A | Read-only governance | Edit projects, approve gates, manage milestone / issue / risk | Read-only | No sensitive finance action | Gate approver | Sales ownership, finance approval |
| SALES_MANAGER | CRM, proposals, reports | T commercial | Create, edit, submit, approve | View project summaries | - | View contract value, estimated margin | Opportunity and proposal approver | Procurement, gates, finance ops |
| SALES_ENGINEER | CRM and proposals | O commercial | Create, edit, submit own | - | - | Own estimated margin only | None | Approvals, projects, finance ops |
| PROJECT_MANAGER | Projects, PMO, docs | Asg | Linked opportunity / proposal read | Edit projects, submit and approve assigned gates, manage docs / milestones / issues / risks | View linked records | View assigned contract, cost, invoice milestones | Assigned gate and doc approver | Sales creation, contract approval |
| PROJECT_ENGINEER | Projects and docs | Asg | Linked opportunity / proposal read | Edit projects, submit gates, manage docs / milestones / issues | View linked records | - | None | Gate approval, finance, account workspace |
| DESIGN_LEAD | Design, projects, PMO | A design / mixed | Read opportunities / proposals | Design authority, approve assigned gates, manage docs / drawings / technical assessments | View assigned sourcing context | - | Docs, drawings, technical assessment, assigned gates | Contract / invoice approval |
| DESIGN_ENGINEER | Design, projects, docs | Asg | Read linked opportunities / proposals | Create and submit drawings, docs, assessments | View assigned sourcing context | - | None | Gate / document approval, commercial ownership |
| PROCUREMENT | Procurement, projects, docs | Asg plus vendor A | - | Read linked project context | Create, edit, submit RFQ / quote / PO / delivery | PO approved by others | None | Gate approval, contract / invoice approval |
| SITE_SUPERVISOR | Projects, docs | Asg | - | Site logs, checklists, punch list, issues | Delivery view only | - | None | Gates, procurement creation, finance |
| COMMISSIONING_ENGINEER | Projects, docs, O&M | Asg | - | Testing, punch list, handover docs, assets, warranty | - | - | Submit commissioning pack only | Gates, contracts, finance approval |
| OM_ENGINEER | O&M, projects, docs | Asg | - | Post-handover support only | - | - | None | Pre-handover delivery control, sales, gates |
| FINANCE_ADMIN | Reports, projects, docs | A finance / oversight | Read-only commercial visibility | Read-only delivery context | Approve and export POs | Create / edit contracts, approve invoice milestones, view cost / margin / payment | Invoice milestone and PO approver | Gates, technical delivery control |

## Quick Reading Notes

- `DIRECTOR` is the widest business role.
- `SUPER_ADMIN` is still the only system administration role.
- `PROJECT_ENGINEER` is a contributor role, not an approver role.
- `PMO_MANAGER` governs delivery health but does not own commercial workflow.
- `FINANCE_ADMIN` has strong financial control but does not control project gates.
