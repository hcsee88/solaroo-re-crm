# Opportunity Health Rules — Sales Pipeline Lite

**Date:** 2026-05-08 (rewritten for Lite — supersedes the V1 4-state model)
**Status:** Implemented
**Source of truth:** `apps/api/src/modules/opportunities/opportunity-health.ts`

This document defines the **exact** rules used to compute the three-state health label of every opportunity. Health is **never stored** — it is computed at read time on the API side and surfaced on the opportunity list, the opportunity detail header, and the sales pipeline dashboard.

---

## 1. Lite scope — three states, no `AT_RISK`

The original V1 plan had four states (HEALTHY / AT_RISK / STALE / OVERDUE) with 7-day and 14-day thresholds. The Lite revision removes **AT_RISK** and pushes **STALE** to 30 days.

Why:

- The 7-day AT_RISK pill fired too often. Many opps with 7–14 days silence had a future-dated next action and were genuinely fine — the amber pill created noise without actionable signal.
- A 14-day STALE threshold pressured the team unnecessarily. 30 days is the calm threshold this 15-person team can sustain.
- Three states are easier to scan in a list view (one happy state, two warning states) than four (where AT_RISK and STALE were visually similar).

The lost AT_RISK signal is partially recovered by the "No next action" filter chip on the opportunity list, which surfaces a different (and more actionable) failure mode.

---

## 2. The three states

| State | Colour | UI label | Meaning |
|---|---|---|---|
| `HEALTHY` | green | "Healthy" | Active deal with recent activity (within 30 days) and no overdue follow-up |
| `OVERDUE` | red | "Overdue" | An open next action whose due date has passed |
| `STALE` | amber | **"Needs follow-up"** | No activity for more than 30 days |

The UI label "Needs follow-up" replaces "Stale" because it's action-oriented rather than diagnostic. The enum value stays `STALE` for code stability.

---

## 3. Inputs

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

`lastActivityAt` is computed by `OpportunitiesService` as part of the standard list query.

---

## 4. The decision rules — exact order

The function returns the **first match**. Priority means OVERDUE > STALE > HEALTHY.

```
1. If stage ∈ {WON, LOST, ON_HOLD}
       → HEALTHY        // terminal stages have no follow-up obligation

2. If next-action is "open" AND nextActionDueDate < now
       → OVERDUE
   "open" = nextActionStatus is neither COMPLETED nor CANCELLED

3. If lastActivityAt is null OR (now - lastActivityAt) > 30 days
       → STALE

4. Otherwise
       → HEALTHY
```

### Concrete examples

| Stage | Next Action | Due Date | Status | Last Activity | Result | Why |
|---|---|---|---|---|---|---|
| `CONCEPT_DESIGN` | "Send revised BoQ" | tomorrow | PENDING | 5 days ago | HEALTHY | recent + future-dated action |
| `CONCEPT_DESIGN` | "Send revised BoQ" | yesterday | PENDING | 5 days ago | OVERDUE | due date passed wins over recency |
| `CONCEPT_DESIGN` | "Send revised BoQ" | yesterday | COMPLETED | 5 days ago | HEALTHY | completed action ≠ open |
| `CONCEPT_DESIGN` | "Send revised BoQ" | yesterday | CANCELLED | 5 days ago | HEALTHY | cancelled action ≠ open |
| `BUDGETARY_PROPOSAL` | null | — | — | 10 days ago | HEALTHY | no plan, but recent activity, < 30d |
| `BUDGETARY_PROPOSAL` | "Chase for sign-off" | 5d future | PENDING | 35 days ago | STALE | > 30d silent |
| `WON` | null | — | — | 60 days ago | HEALTHY | terminal stage exits early |
| `LEAD` | null | — | — | (never) | STALE | null lastActivityAt → infinity |

Note that "no next action" is **not** a health state by itself in Lite — it's surfaced via the opportunity-list filter chip "No next action" instead. This keeps health focused on activity recency + due-date discipline.

---

## 5. Constants

```ts
const STALE_DAYS = 30;
```

Defined inline in `apps/api/src/modules/opportunities/opportunity-health.ts`. To tune: change the constant, redeploy. No DB migration required.

The worker uses two related constants in `services/worker/src/index.ts`:

```ts
const NO_ACTIVITY_DAYS          = 30;   // matches the health pill's STALE threshold
const PROPOSAL_NO_FOLLOWUP_DAYS = 7;    // stage-aware nudge for proposal-stage opps only
```

The proposal-stage 7-day nudge does not affect the health pill (which stays uniform 30d). It only fires the in-app `proposal_no_followup` notification.

---

## 6. Effective next-action status

A separate helper, `computeNextActionStatus(...)`, returns one of:

| Status | When |
|---|---|
| `NONE` | no `nextAction` set, or `nextActionStatus === 'CANCELLED'` |
| `COMPLETED` | `nextActionStatus === 'COMPLETED'` |
| `OVERDUE` | open AND `nextActionDueDate < now` |
| `PENDING` | open AND not overdue (or no due date) |

The opportunity list filter `?nextActionStatus=…` accepts these effective values.

---

## 7. Where health appears

| Surface | How |
|---|---|
| Opportunity list (`/opportunities`) | Health column with pill |
| Opportunity detail header | Pill next to the stage badge |
| Sales pipeline dashboard (`/sales-pipeline`) | Counts surfaced as "Stale opportunities" / "Overdue follow-ups" / "Active opportunities" |
| Opportunity API responses | Both list-item and detail responses include `health` and `effectiveNextActionStatus` |

---

## 8. Visibility

Health is **not** considered a sensitive value — it's a computed status, not a commercial number. Any user authorised to view the underlying opportunity can see its health pill. Sensitive value display (margin, CAPEX, pipeline value) follows the existing role-UI rules in `apps/web/src/lib/role-ui.ts` and is unchanged.

---

## 9. Test surface

`opportunity-health.ts` is a **pure function** — no DB, no IO, no clock except via the injectable `now` argument. The example table in § 4 is essentially the test plan; unit tests are tracked as a V2 follow-up in `docs/sales-pipeline-lite.md` § 7.

---

## 10. Backwards-compatibility shim

The frontend `<HealthBadge>` component remaps any incoming `AT_RISK` value to `STALE` for one rolling-deploy cycle. This protects against:

- Stale pages cached in the user's browser still expecting the old enum
- Any external consumer (none today) still asking for `AT_RISK`

The shim should be removed in the next sprint.

---

## 11. Out of scope (V2 candidates)

- Per-stage thresholds for the health pill (currently uniform 30d)
- "Trending" health (e.g. "Stale getting worse for 3 weeks")
- AI-driven health (ML-based win-likelihood)
- User-customisable thresholds
