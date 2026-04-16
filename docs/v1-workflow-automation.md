# V1 Workflow Automation

> Solaroo RE CRM — internal reference document  
> Last updated: 2026-04-16

---

## 1. Overview

This document defines the V1 workflow model for gate and proposal automation, including notification routing, actor roles, and escalation rules. It distinguishes what is implemented in V1 from what is deferred.

The core principle: **notifications inform, they never auto-approve**. Every status change is actor-initiated and audit-logged. Notifications direct attention; humans close gates.

---

## 2. Role Hierarchy (Gate & Proposal Context)

| Role | Gate responsibility | Proposal responsibility |
|---|---|---|
| **PM (Project Manager)** | Owns gate execution; submits gates for approval | Receives decision notification |
| **PE (Design Engineer)** | Completes deliverables; no gate approval rights | Drafts proposals |
| **Sales Manager** | No gate role | Approves proposals (role-based approver) |
| **PMO Manager** | Reviews and flags gates; approves gates | — |
| **Director** | Final gate approver | Approves proposals |
| **Site Supervisor** | Updates deliverable status | — |
| **Commissioning Engineer** | Final gate (G5) deliverables | — |

**Key constraint**: Design Engineers (PE role) cannot approve gates. Gate approval is restricted to PMO_MANAGER and DIRECTOR roles. The PM submits; approvers decide.

---

## 3. Gate Workflow Model

### 3.1 Gate Status States

```
NOT_STARTED → IN_PROGRESS → SUBMITTED → APPROVED
                    ↑               ↓
                    └──── REJECTED ←┘
```

- **NOT_STARTED**: Gate not yet reached; deliverables cannot be modified.
- **IN_PROGRESS**: PM is actively working deliverables. Deliverable status can be updated.
- **SUBMITTED**: PM has submitted for approval. Approvers are notified. PM cannot modify deliverables while in SUBMITTED state.
- **APPROVED**: Gate closed. Audit record stamped with approver ID and timestamp. `currentGateNo` advances automatically.
- **REJECTED**: Returned to PM for rework. Rejection reason (remarks) is mandatory. Gate reverts to IN_PROGRESS after PM acknowledges.

### 3.2 Gate Transition Rules

| From | Actor | Allowed transition | Remarks |
|---|---|---|---|
| IN_PROGRESS | PM | → SUBMITTED | Optional notes |
| SUBMITTED | DIRECTOR / PMO_MANAGER | → APPROVED | Optional |
| SUBMITTED | DIRECTOR / PMO_MANAGER | → REJECTED | **Required** rejection reason |
| REJECTED | PM | → IN_PROGRESS | Optional notes (re-open) |

Role enforcement is at the API layer (`projects.service.ts → updateGateStatus`). The frontend shows buttons based on status, but the backend validates actor permissions.

### 3.3 PMO Flag

PMO can flag a gate without approving/rejecting it. Flags communicate concern to the Director without blocking the workflow.

- `pmoFlagged: boolean` — displayed as amber "⚑ PMO Flagged" badge on gate header.
- `pmoComment: string | null` — displayed in the gate expanded panel under "PMO comment".
- Flagging is a separate PATCH action; it does not change gate `status`.

---

## 4. Notification Rules

### 4.1 Gate Notifications

| Trigger | Recipients | Title format | Link |
|---|---|---|---|
| Gate → SUBMITTED | All DIRECTOR and PMO_MANAGER role users (excl. actor) | `Gate approval required: [PROJECT_CODE] G[N] — [GATE_NAME]` | `/projects/{id}` |
| Gate → APPROVED | Project Manager + all project members (excl. actor) | `Gate approved: [PROJECT_CODE] G[N] — [GATE_NAME]` | `/projects/{id}` |
| Gate → REJECTED | Project Manager + all project members (excl. actor) | `Gate rejected: [PROJECT_CODE] G[N] — [GATE_NAME]` | `/projects/{id}` |

### 4.2 Proposal Notifications

| Trigger | Recipients | Title format | Link |
|---|---|---|---|
| Proposal version submitted for approval | All SALES_MANAGER and DIRECTOR role users listed as approvers (excl. actor) | `Proposal approval required: [PROPOSAL_CODE] v[N]` | `/proposals/{id}` |
| Proposal version → APPROVED | Proposal creator | `Proposal approved: [PROPOSAL_CODE] v[N]` | `/proposals/{id}` |
| Proposal version → REJECTED | Proposal creator | `Proposal rejected: [PROPOSAL_CODE] v[N]` | `/proposals/{id}` |
| Proposal version → RETURNED (DRAFT) | Proposal creator | `Proposal returned for revision: [PROPOSAL_CODE] v[N]` | `/proposals/{id}` |

### 4.3 Delivery Pattern

All notifications are sent **fire-and-forget** using `.catch(() => {})` at the call site. This ensures notification failures never roll back primary transactions (gate status changes, proposal decisions).

```typescript
// Pattern used throughout:
this.sendGateNotifications(projectId, gateNo, gateName, newStatus, actor)
  .catch(() => {}); // never blocks the primary response
```

### 4.4 Notification Fields

| Field | Description |
|---|---|
| `type` | Machine-readable: `gate_submitted`, `gate_approved`, `gate_rejected`, `proposal_submitted`, `proposal_approved`, `proposal_rejected`, `proposal_returned` |
| `resource` | `project` or `proposal` |
| `resourceId` | The project or proposal UUID |
| `linkUrl` | Direct deep link to the relevant page |
| `status` | UNREAD → READ → DISMISSED |

### 4.5 Deduplication (V2)

V1 does not deduplicate. If a gate is submitted, rejected, resubmitted, and approved, four notifications are sent. Deduplication (collapsing same-resource events) is deferred to V2.

---

## 5. In-App Notification Bell

### 5.1 Behaviour

- Polls `GET /notifications/unread-count` every **30 seconds**.
- Opens a dropdown panel on click, fetching `GET /notifications` (most recent 30, non-dismissed).
- Badge shows exact count up to 99, then "99+".
- Clicking a notification: marks it READ (`PATCH /notifications/{id}/read`) and navigates to `linkUrl`.
- "Mark all read" button: `PATCH /notifications/read-all`.
- Dismiss button (hover): `PATCH /notifications/{id}/dismiss` — removes from panel, not from database.

### 5.2 Per-type Colour Accents

| Notification type | Accent colour |
|---|---|
| gate_submitted | #fdab3d (amber) |
| gate_approved | #00ca72 (green) |
| gate_rejected | #e2445c (red) |
| proposal_submitted | #0073ea (blue) |
| proposal_approved | #00ca72 (green) |
| proposal_rejected | #e2445c (red) |
| proposal_* (other) | #a25ddc (purple) |
| default | #676879 (grey) |

### 5.3 Bell component location

`apps/web/src/components/layout/notification-bell.tsx`  
Rendered in `apps/web/src/components/layout/topbar.tsx`.

---

## 6. Gate Action Modal

Gate action buttons (Submit / Approve / Reject / Re-open) no longer fire directly to the API. Instead they open a confirmation modal that:

1. Shows the action title and plain-English description of consequences.
2. Provides a `remarks` textarea (required for REJECT, optional for others).
3. Confirms before calling `PATCH /projects/{id}/gates/{gateNo}/status`.

This ensures actors never accidentally approve or reject a gate, and rejection always carries a recorded reason.

---

## 7. API Endpoints (Notifications)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/notifications` | JWT | Fetch non-dismissed notifications (max 30) |
| GET | `/notifications/unread-count` | JWT | Returns `{ count: number }` |
| PATCH | `/notifications/read-all` | JWT | Mark all as READ |
| PATCH | `/notifications/:id/read` | JWT | Mark one as READ |
| PATCH | `/notifications/:id/dismiss` | JWT | Dismiss one notification |

All endpoints are scoped to the authenticated user — users cannot see or modify each other's notifications.

---

## 8. Overdue & Escalation (V2 — Deferred)

The following are **not implemented in V1**:

- **Overdue gate detection**: No scheduled job to flag gates where `targetDate` has passed and `status !== APPROVED`.
- **Escalation notifications**: No automatic re-notification to Director if a gate sits in SUBMITTED for >48 hours.
- **RAG auto-calculation**: RAG status is currently set manually by the PM. Auto-calculation from overdue gates is deferred.
- **Email delivery**: V1 delivers in-app notifications only. Email integration (via SendGrid or SMTP) is deferred to V2.
- **Weekly digest**: No digest or summary email in V1.
- **Push / mobile notifications**: Out of scope for V1.

---

## 9. V1 vs V2 Summary

| Capability | V1 | V2 |
|---|---|---|
| Gate status workflow | ✅ | — |
| Gate action modal with remarks | ✅ | — |
| PMO flag + comment display | ✅ | — |
| In-app notification bell | ✅ | — |
| Notification polling (30s) | ✅ | — |
| Gate submit/approve/reject notifications | ✅ | — |
| Proposal submit/decision notifications | ✅ | — |
| Fire-and-forget delivery (non-blocking) | ✅ | — |
| Email delivery | ❌ | Planned |
| Overdue gate auto-detection | ❌ | Planned |
| Escalation re-notification | ❌ | Planned |
| RAG auto-calculation from gate dates | ❌ | Planned |
| Notification deduplication/collapsing | ❌ | Planned |
| Push notifications | ❌ | Out of scope |

---

## 10. Files Changed (V1 Automation Implementation)

| File | Change |
|---|---|
| `packages/db/prisma/audit.prisma` | `Notification` model with status, type, linkUrl, resource, resourceId |
| `apps/api/src/modules/notifications/notifications.service.ts` | Full implementation: create, createMany, findAll, unreadCount, markRead, markAllRead, dismiss, getUserIdsByRoles, getProjectMemberIds |
| `apps/api/src/modules/notifications/notifications.controller.ts` | 5 REST endpoints |
| `apps/api/src/modules/notifications/notifications.module.ts` | Exports NotificationsService |
| `apps/api/src/modules/projects/projects.module.ts` | Imports NotificationsModule |
| `apps/api/src/modules/projects/projects.service.ts` | Injects NotificationsService; `sendGateNotifications()` called fire-and-forget |
| `apps/api/src/modules/proposals/proposals.module.ts` | Imports NotificationsModule |
| `apps/api/src/modules/proposals/proposals.service.ts` | Notification calls in `submitForApproval()` and `recordDecision()` |
| `apps/web/src/components/layout/notification-bell.tsx` | Full notification bell component (new) |
| `apps/web/src/components/layout/topbar.tsx` | Replaces decorative Bell with `<NotificationBell />` |
| `apps/web/src/app/(app)/projects/[id]/page.tsx` | GateActionModal, pmoFlagged badge, remarks/pmoComment display, updated `handleGateAdvance` signature |
