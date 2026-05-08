# Opportunity Health Rules — V1

**Date:** 2026-05-08
**Status:** Implemented
**Source of truth:** `apps/api/src/modules/opportunities/opportunity-health.ts`

This document defines the **exact** rules used to compute the four-state health label of every opportunity. Health is **never stored** — it is computed at read time on the API side and surfaced on the opportunity list, the opportunity detail header, and the sales pipeline dashboard.

---

## 1. Why compute, not store

- No worker reconciliation step needed. The dashboard is always fresh.
- No data drift if a salesperson edits an activity or due date — the health flips on the next read.
- No migration burden when thresholds are tuned (e.g., changing AT_RISK from 7 to 10 days is a one-line code change, no backfill).

---

## 2. The four states

| State | Colour | Meaning |
|---|---|---|
| `HEALTHY` | green | Active deal with recent activity and a future-dated next action |
| `AT_RISK` | amber | No activity for more than 7 days, or no next action recorded |
| `STALE` | orange | No activity for more than 14 days |
| `OVERDUE` | red | An open next action whose due date has passed |

---

## 3. Inputs

The function takes only what's already on the opportunity row plus one denormalised value:

```ts
{
  stage:               OpportunityStage    // e.g. 'CONCEPT_DESIGN', 'WON', 'LOST'
  nextAction:          string | null       // free-text description
  nextActionDueDate:   Date | null         // when it's due
  nextActionStatus:    'PENDING' | 'COMPLETED' | 'CANCELLED' | null
  lastActivityAt:      Date | null         // most recent activity occurredAt
  now?:                Date                // injectable for testing; defaults to current time
}
```

`lastActivityAt` is computed by the OpportunitiesService once per query (single subquery — see `lastActivityAt(opportunityId)` in `activities.service.ts`).

---

## 4. The decision rules — exact order

The function returns the **first match** in this order. This priority means OVERDUE always wins over STALE, STALE always wins over AT_RISK, etc.

```
1. If stage ∈ {WON, LOST, ON_HOLD}
       → HEALTHY     // terminal stages have no follow-up obligation

2. If next-action is "open" AND nextActionDueDate < now
       → OVERDUE
   "open" = nextActionStatus is neither COMPLETED nor CANCELLED

3. If lastActivityAt is null OR (now - lastActivityAt) > 14 days
       → STALE

4. If (now - lastActivityAt) > 7 days
       → AT_RISK

5. If nextAction is null or empty
       → AT_RISK     // recent activity but no plan = still at risk

6. Otherwise
       → HEALTHY
```

### Concrete examples

| Stage | Next Action | Due Date | Status | Last Activity | Result | Why |
|---|---|---|---|---|---|---|
| `CONCEPT_DESIGN` | "Send revised BoQ" | tomorrow | PENDING | 2 days ago | HEALTHY | recent + future-dated action |
| `CONCEPT_DESIGN` | "Send revised BoQ" | yesterday | PENDING | 2 days ago | OVERDUE | due date passed wins over recency |
| `CONCEPT_DESIGN` | "Send revised BoQ" | yesterday | COMPLETED | 2 days ago | HEALTHY | completed action ≠ open |
| `BUDGETARY_PROPOSAL` | null | — | — | 10 days ago | AT_RISK | no plan + > 7d silent |
| `BUDGETARY_PROPOSAL` | "Chase for sign-off" | 5d future | PENDING | 18 days ago | STALE | > 14d silent dominates |
| `WON` | null | — | — | 60 days ago | HEALTHY | terminal stage exits early |
| `LEAD` | null | — | — | (never) | STALE | null lastActivityAt → infinity |

---

## 5. Constants

```ts
const AT_RISK_DAYS = 7;
const STALE_DAYS   = 14;
```

Defined inline in `apps/api/src/modules/opportunities/opportunity-health.ts`. To tune: change the constant, redeploy. No DB migration required.

---

## 6. Effective next-action status

A separate helper, `computeNextActionStatus(...)`, returns one of:

| Status | When |
|---|---|
| `NONE` | no `nextAction` set, or `nextActionStatus === 'CANCELLED'` |
| `COMPLETED` | `nextActionStatus === 'COMPLETED'` |
| `OVERDUE` | open AND `nextActionDueDate < now` |
| `PENDING` | open AND not overdue (or no due date) |

The opportunity list filter `?nextActionStatus=…` accepts these effective values, not the raw stored ones — so a UI chip "Overdue next action" maps to a single API parameter.

---

## 7. Where health appears

| Surface | How |
|---|---|
| Opportunity list (`/opportunities`) | New "Health" column; optional filter chip "Overdue" |
| Opportunity detail header | Pill next to the stage badge |
| Sales pipeline dashboard (`/sales-pipeline`) | Counts surfaced as "Stale opportunities" / "Overdue next actions" / "Active opportunities" / "Won this month" |
| Opportunity API responses | Both list-item and detail responses include `health` and `effectiveNextActionStatus` |

---

## 8. Visibility

Health is **not** considered a sensitive value — it's a computed status, not a commercial number. Any user authorised to view the underlying opportunity can see its health pill. Sensitive value display (margin, CAPEX, pipeline value) follows the existing role-UI rules in `apps/web/src/lib/role-ui.ts` and is unchanged by this module.

---

## 9. Test surface

`opportunity-health.ts` is a **pure function** — no DB, no IO, no clock except via the injectable `now` argument. This makes it trivially testable:

```ts
import { computeOpportunityHealth } from '...';

it('marks > 14d silent as STALE', () => {
  expect(
    computeOpportunityHealth({
      stage: 'CONCEPT_DESIGN',
      nextAction: 'x',
      nextActionDueDate: null,
      nextActionStatus: 'PENDING',
      lastActivityAt: new Date('2026-04-01'),
      now: new Date('2026-05-01'),
    })
  ).toBe('STALE');
});
```

(Test file is not yet created — flagged as a follow-up in `dev_log/dev_log_260508.txt`.)

---

## 10. Out of scope

- "Trending" health (e.g. "AT_RISK getting worse for 3 weeks") — V1 is a snapshot, not a trend
- Per-stage thresholds (every stage uses the same 7d / 14d cutoff)
- AI-driven health (e.g. ML model trained on win/loss patterns)
- User-customisable thresholds
