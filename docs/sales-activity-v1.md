# Sales Activity V1 — Specification

**Date:** 2026-05-08
**Status:** Implemented
**Source of truth:** `apps/api/src/modules/activities/`, `packages/db/prisma/schema/crm.prisma` (`Activity`, `ActivityType`, `NextActionStatus`)

This document defines the **Sales Activity** module — the manual logging layer that gives the CRM a sales operating rhythm without integrating with email, WhatsApp, telephony, calendar, or AI.

---

## 1. Product decision: manual only

Sales activity tracking is **manual only** in V1.

The CRM does **not**:

- Read inboxes (Gmail / Outlook / IMAP)
- Send messages (Twilio / Meta WhatsApp Business / SMTP)
- Sync calendars (Google Calendar / Outlook / iCloud)
- Listen on phone systems (any PBX / VoIP / softphone)
- Use AI to summarise, draft, or auto-create activities

Salespeople perform the action outside the CRM (call, email, WhatsApp, meeting, site visit) and **log it after the fact**. The CRM tracks **what happened, when, and what's next** — not the channel itself.

This is intentional. Manual logging gives immediate operational value without integration cost or vendor lock-in. Channel integrations may be considered post-V1 once the manual rhythm proves the workflow has product-market fit.

---

## 2. Activity model

```prisma
model Activity {
  id            String       @id @default(cuid())
  type          ActivityType
  subject       String       // one-line summary, required
  body          String?      // optional longer note
  occurredAt    DateTime     // when the action happened (back-dating allowed)
  createdAt     DateTime     @default(now())  // when the row was inserted

  ownerUserId   String       // who logged it / performed the touchpoint
  accountId     String?
  contactId     String?
  siteId        String?
  opportunityId String?

  owner         User         @relation("ActivityOwner", fields: [ownerUserId], references: [id])
  account       Account?     @relation(fields: [accountId], references: [id])
  contact       Contact?     @relation(fields: [contactId], references: [id])
  site          Site?        @relation(fields: [siteId], references: [id])
  opportunity   Opportunity? @relation(fields: [opportunityId], references: [id])

  @@index([opportunityId, occurredAt])
  @@index([accountId, occurredAt])
  @@index([ownerUserId, occurredAt])
  @@map("activities")
}
```

**Required fields on create:**

- `type`
- `subject`
- `occurredAt`
- At least one link (`opportunityId`, `accountId`, `contactId`, or `siteId`) — enforced at the Zod layer.

**Auto-filled by service:**

- `ownerUserId` ← current user (cannot be overridden by client)
- `accountId` / `siteId` ← inherited from `opportunityId` if linkable record is present and these fields are blank

---

## 3. Activity types

| Enum value | Display label | Use when |
|---|---|---|
| `CALL` | Call | Phone call (inbound or outbound) |
| `EMAIL` | Email | Sent or received email correspondence |
| `WHATSAPP` | WhatsApp | WhatsApp / chat conversation |
| `MEETING` | Meeting | In-person or virtual meeting |
| `SITE_VISIT` | Site Visit | On-site visit; optionally link to a `Site` |
| `PROPOSAL_FOLLOW_UP` | Proposal Follow-up | Specifically chasing an outstanding proposal |
| `GENERAL_NOTE` | Note | Catch-all internal observation; **prefer over a more specific type only when no other type fits** |

**Legacy values** (`NOTE`, `TASK`) are kept in the enum for backwards compatibility with rows created before V1 and **must not be used by new code**. The UI maps any incoming `NOTE` to `GENERAL_NOTE` for display.

---

## 4. Ownership rules

| Field | Source of truth | Notes |
|---|---|---|
| `ownerUserId` | Set by service from the authenticated user | Client cannot override on create or update |
| Activity scope (who can see it) | `activity:view:{scope}` permission | `own` / `assigned` / `team` / `all` (see permission seed) |

**Per-role view scopes** (granted by `packages/db/src/seeds/permissions.seed.ts`):

| Role | Scope |
|---|---|
| SALES_ENGINEER | `own` |
| SALES_MANAGER | `team` |
| DIRECTOR · PMO_MANAGER · FINANCE_ADMIN | `all` |
| PROJECT_MANAGER · PROJECT_ENGINEER · DESIGN_ENGINEER | `assigned` (activities tied to projects/opportunities they're assigned to) |
| Other roles | none (403) |

---

## 5. Editing rules

The activity timeline is **immutable history**. Edits are intentionally tightly scoped — they exist for typo / quick-correction within minutes of logging, not for after-the-fact rewriting.

| Who | Window | Allowed |
|---|---|---|
| **Creator** | **Same calendar day only** as `createdAt` | ✅ Edit `type` / `subject` / `body` / `occurredAt` |
| **Creator** | After the same-day window | ❌ — must add a follow-up activity instead |
| **Anyone other than the creator** | Any time | ❌ — `403 Forbidden` |
| **DIRECTOR / SUPER_ADMIN** | Any time | ✅ Corrective override only — should be rare and visible in the audit log |

The auto-audit interceptor records every edit with the actor, the diff (field names), and the timestamp.

---

## 6. Deletion rules

Hard delete (no soft archive). Permission scoped, role-checked.

| Who | Allowed |
|---|---|
| **Creator** | ✅ Delete their own activity at any time |
| **SALES_MANAGER** | ✅ Delete any activity within their team scope |
| **DIRECTOR / SUPER_ADMIN** | ✅ Delete any activity (corrective override) |
| **All other roles** | ❌ — `403 Forbidden` |

The audit log records the deletion (actor, resource, resourceId, action="deleted") **before** the row is removed, so the trail of who logged-then-removed an activity is preserved.

---

## 7. Next-Action discipline

Every **live** opportunity (i.e. stage not in `WON` / `LOST` / `ON_HOLD`) should carry **one and only one open Next Action**.

### Stored fields on `Opportunity`

| Field | Type | Purpose |
|---|---|---|
| `nextAction` | `String?` (text, max 500) | What needs to happen next, free-text |
| `nextActionType` | `NextActionType?` | Structured type chip — `FOLLOW_UP` / `SITE_SURVEY` / `REVISED_QUOTATION` / `CLIENT_MEETING` / `INTERNAL_REVIEW` / `OTHER` |
| `nextActionDueDate` | `DateTime?` | When it must be done by — drives OVERDUE flag |
| `nextActionOwnerId` | `String?` | Who owns the action (defaults to opp owner) |
| `nextActionStatus` | `NextActionStatus` | `PENDING` (open) / `COMPLETED` (done) / `CANCELLED` (won't do) |
| `nextActionCompletedAt` | `DateTime?` | Set when status flips to COMPLETED |

### Status-name mapping (V1 spec ↔ schema)

The V1 spec uses the verbal labels `OPEN` / `DONE` / `CANCELLED`. The schema uses `PENDING` / `COMPLETED` / `CANCELLED` (kept for backwards compatibility with existing data). Mapping:

| Spec label | Stored value |
|---|---|
| `OPEN` | `PENDING` |
| `DONE` | `COMPLETED` |
| `CANCELLED` | `CANCELLED` |

The UI may render the spec labels for clarity; the API and database use the stored values.

### Lifecycle rules

- A new opportunity may be created without a next action; the system flags it as `AT_RISK` immediately.
- When a next action is set, `nextActionStatus` defaults to `PENDING`.
- Marking it `COMPLETED` (or `CANCELLED`) frees the slot — the user **should** then set the next next-action.
- The system does not enforce single-open at the database level (no partial unique index); it is enforced via the UI: the panel always shows the most-recent action, and "set new" replaces in place. Reporting and health treat the stored row as the authoritative open action.
- **Stage transition** (e.g. CONCEPT_DESIGN → BUDGETARY_PROPOSAL) does NOT auto-clear the next action. The salesperson explicitly sets the next one in the new stage.

### Endpoint

`PATCH /api/opportunities/:id/next-action` (dedicated route, finer permission grain than full opp edit; see `apps/api/src/modules/opportunities/opportunities.controller.ts`).

Body (Zod-validated):

```json
{
  "nextAction":        "Call site to confirm survey window",
  "nextActionType":    "SITE_SURVEY",
  "nextActionDueDate": "2026-05-15T00:00:00.000Z",  // null clears
  "nextActionOwnerId": "<userId>",                  // null clears
  "nextActionStatus":  "PENDING"                    // or COMPLETED, CANCELLED
}
```

---

## 8. Notification hooks

In-app only (the `Notification` table + the worker's `setInterval` loop). No email, no WhatsApp, no SMS in V1.

| Trigger | Worker tick | Routed to |
|---|---|---|
| `next_action_overdue` | hourly check, deduped 22h | action owner + opp owner |
| `proposal_no_followup` | hourly, fires at `>= 3 days` since last activity on a `BUDGETARY_PROPOSAL` / `FIRM_PROPOSAL` stage opp | opp owner |
| `opportunity_stale` | hourly, fires at `>= 14 days` since last activity on a non-terminal opp | opp owner |

Constants (see `services/worker/src/index.ts`):

```ts
const SALES_TICK_MS              = 60 * 60 * 1000;  // hourly
const RECENT_DEDUPE_HOURS        = 22;
const NO_ACTIVITY_DAYS           = 14;
const PROPOSAL_NO_FOLLOWUP_DAYS  = 3;
```

Dedupe is via the `Notification` table itself — no extra schema field. Each tick checks "did we already create a matching `(userId, type, resource, resourceId)` notification within `RECENT_DEDUPE_HOURS`?" and skips if so.

---

## 9. API summary

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/api/activities` | `activity:view` | Paginated, filterable by `opportunityId` / `accountId` / `contactId` / `siteId` / `ownerUserId` / `type` / date range |
| GET | `/api/activities/:id` | `activity:view` | Detail (rarely used directly; timeline embeds) |
| POST | `/api/activities` | `activity:create` | Logs new activity |
| PATCH | `/api/activities/:id` | `activity:edit` | Same-day window |
| DELETE | `/api/activities/:id` | `activity:delete` | Creator / Sales Manager / Director |
| PATCH | `/api/opportunities/:id/next-action` | `opportunity:edit` | Set / update / complete the next action |

---

## 10. Out of scope for V1

- Email integration (no Gmail / Outlook / IMAP / SMTP)
- WhatsApp integration (no Meta Business API)
- Telephony integration (no Twilio / softphone hooks)
- Calendar integration (no Google / Outlook calendar sync)
- AI automation (no auto-summary, no auto-next-action suggestions)
- Threaded comments on activities
- Attachments on activities (use the Documents module instead — link the document to the same opportunity / project / contract)

These items are documented as deferred in `docs/v1-product-direction.md` § Post-V1 Priorities.
