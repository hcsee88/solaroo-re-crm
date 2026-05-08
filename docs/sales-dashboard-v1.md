# Sales Pipeline Dashboard V1 — Specification

**Date:** 2026-05-08
**Status:** Implemented
**Page:** `/sales-pipeline`
**Source of truth:** `apps/api/src/modules/reporting/reporting.service.ts` (`getSalesPipelineMetrics`), `apps/web/src/app/(app)/sales-pipeline/page.tsx`

This document defines what the sales pipeline dashboard shows, how each KPI is computed, and which roles see which numbers.

---

## 1. Purpose

Give Director, Sales Manager, and Sales Engineer one screen that answers:

- How much pipeline do we have, and where is it bunching?
- Who's chasing what, and who's idle?
- Which deals are overdue or stalling?
- What's about to close this month / quarter?
- What did we win this month?

If a question can be answered from this page, the user should not need to open the opportunities list to answer it.

---

## 2. Visibility

Visible in the sidebar to:

- `DIRECTOR`
- `SALES_MANAGER`
- `SALES_ENGINEER`

Not visible to:

- `SUPER_ADMIN` (no business workspace)
- `PROJECT_MANAGER` / `PROJECT_ENGINEER` / `DESIGN_LEAD` / `DESIGN_ENGINEER` / `PROCUREMENT` / `SITE_SUPERVISOR` / `COMMISSIONING_ENGINEER` / `OM_ENGINEER` / `FINANCE_ADMIN` (PMO dashboard / project workspace are their primary surfaces)

The page route itself is gated by `getNavItemsForRole(...)` in `apps/web/src/lib/role-ui.ts`. If a role outside the visible set navigates to the URL directly, the API still responds (the underlying reporting endpoint requires only authentication), but their pipeline data is filtered to their scope (a `SALES_ENGINEER` sees only their own opportunities).

### Sensitive value display

Pipeline value (RM totals) and per-owner totals are sensitive. The display layer respects the existing rules in `apps/web/src/lib/role-ui.ts`:

| Section | DIRECTOR | SALES_MANAGER | SALES_ENGINEER |
|---|---|---|---|
| Pipeline summary value | ✅ shown | ✅ shown | ❌ hidden (count only) |
| By-stage value | ✅ shown | ✅ shown | ❌ hidden (count only) |
| Closing forecast value | ✅ shown | ✅ shown | ❌ hidden (count only) |
| Top 10 largest open opps | ✅ shown | ✅ shown | ❌ hidden (count only) |
| Won this month value | ✅ shown | ✅ shown | ❌ hidden (count only) |
| Activity counts / overdue counts / stale counts | ✅ shown to all three roles |

The reasoning: a sales engineer may be a contractor or junior, and should not see the team's commercial totals. Their own deal value is visible on their own opportunity detail pages (existing rule).

---

## 3. Quick cards (top of page)

Six small cards. Each shows a count and a click-through label.

| Card | Definition | Click target |
|---|---|---|
| **Active Opportunities** | `count where stage NOT IN (WON, LOST, ON_HOLD) AND isActive = true`, in user's scope | `/opportunities?myOnly=true` (or unfiltered for managers) |
| **Overdue Next Actions** | `count where nextActionStatus = PENDING AND nextActionDueDate < now`, in user's scope | `/opportunities?overdueNextAction=true` |
| **Stale Opportunities** | `count where stage NOT IN (WON, LOST, ON_HOLD) AND lastActivityAt is null OR > 14 days ago`, in user's scope | `/opportunities?noActivity30d=true` |
| **Closing This Month** | `count where stage NOT IN (WON, LOST, ON_HOLD) AND expectedAwardDate within current month` | `/opportunities?closingThisMonth=true` |
| **Proposal Follow-ups Due** | `count where stage IN (BUDGETARY_PROPOSAL, FIRM_PROPOSAL) AND no activity in past 3 days` | `/opportunities?proposalSubmitted=true&noActivity14d=true` |
| **Won This Month** | `count where stage = WON AND updatedAt within current month` | `/opportunities?wonThisMonth=true` |

---

## 4. Charts

### Pipeline by Stage

Horizontal bar chart, one bar per stage. X-axis: count of opportunities; tooltip shows weighted value (count × estimatedValue × probabilityPercent / 100, summed). Stage order matches `OpportunityStage` enum order.

Backend: `getSalesPipelineMetrics().stageBreakdown`.

### Pipeline by Owner

> ❗ **Not in V1.** Identified during the V1 audit as the only spec section not yet built. Tracked as a V2 follow-up — the existing reporting.service can be extended with a `groupBy: ownerUserId` query in one place. See dev log 2026-05-08.

### Won vs Lost This Month

Two stacked counts (and values, for managers). Compares activity in the current calendar month only.

Backend: `getSalesPipelineMetrics().wonThisMonth` plus a parallel `lostThisMonth` query.

### Activity Volume This Month

Bar chart by activity type. Shows how many `CALL` / `EMAIL` / `WHATSAPP` / `MEETING` / `SITE_VISIT` / `PROPOSAL_FOLLOW_UP` / `GENERAL_NOTE` activities have been logged this month, in user's scope. Useful for spotting under-loggers.

Backend: `getSalesPipelineMetrics().activitySummary`.

---

## 5. Tables

### Overdue Opportunities

| Column | Source |
|---|---|
| Code | `Opportunity.opportunityCode` |
| Title | `Opportunity.title` |
| Stage | `Opportunity.stage` |
| Owner | `Opportunity.owner.name` |
| Next Action | `Opportunity.nextAction` |
| Due | `Opportunity.nextActionDueDate` (red if past) |
| Days overdue | computed |

Sorted by days-overdue descending. Limit 10.

Backend: `getSalesPipelineMetrics().followUpMonitoring`.

### No Next Action

Live opps with `nextAction IS NULL OR nextAction = ''`. Same column shape as Overdue, minus the Due column.

Sorted by `updatedAt` ascending (oldest neglect first). Limit 10.

### Top 10 Largest Open Opportunities

Live opps (stage NOT IN WON/LOST/ON_HOLD) sorted by `estimatedValue DESC`, limit 10.

| Column | Source |
|---|---|
| Code | `Opportunity.opportunityCode` |
| Title | `Opportunity.title` |
| Stage | `Opportunity.stage` |
| Account | `Opportunity.account.name` |
| Value | `Opportunity.estimatedValue` (hidden for SALES_ENGINEER) |
| Owner | `Opportunity.owner.name` |

Backend: `getSalesPipelineMetrics().topOpportunities`.

---

## 6. API contract

```
GET /api/reporting/sales-pipeline
```

Authenticated; no extra permission required. Returns scope-filtered data based on the caller's `opportunity:view` permission scope (own / team / all).

Response (abridged):

```jsonc
{
  "pipelineSummary":     { "openCount": 23, "weightedValue": 4_550_000, "avgDealSize": 197_826 },
  "stageBreakdown":      [{ "stage": "LEAD", "count": 4, "value": 800_000 }, /* ... */ ],
  "activitySummary":     { "thisMonth": { "CALL": 12, "EMAIL": 23, /* ... */ }, "lastMonth": { /* ... */ } },
  "followUpMonitoring":  { "overdueCount": 3, "items": [/* opp summaries */] },
  "proposalMonitoring":  { "noFollowupCount": 2, "items": [/* opp summaries */] },
  "closingForecast":     { "thisMonth": { "count": 5, "value": 950_000 }, "thisQuarter": { /* */ } },
  "topOpportunities":    [/* up to 10 opp summaries */],
  "wonThisMonth":        { "count": 2, "value": 480_000 }
}
```

Sensitive numeric fields are returned by the API regardless of role; the UI hides them client-side per `role-ui.ts`. (This is a defence-in-depth gap that may be tightened in V2 — see follow-up below.)

---

## 7. Refresh behaviour

- The dashboard is a server-fetched page (Next.js App Router server component on first render, then SWR-style client refresh).
- It re-fetches on focus and on a 60-second interval.
- All numbers are point-in-time — no caching layer beyond Next.js's default fetch dedupe.
- "What did I just log?" is reflected on next refresh; the activity timeline on the opportunity detail page reflects immediately because it's its own SWR query.

---

## 8. Out of scope for V1

- Custom date ranges (everything is "this month" / "this quarter" / "all open")
- Per-team subdivision (one Sales Manager sees their team aggregate; cross-team comparison is Director-only and reads as a single number)
- Forecasting beyond the current quarter
- Drill-down from chart click into an opp list (each card has a click-through, but charts do not)
- Export to CSV / Excel (use the Reports page for that — `/reports`)
- Pipeline by Owner chart (V2 — see § 4)
- Server-side enforcement of sensitive-value visibility (V2 — currently UI-side only)
