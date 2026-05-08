# Sales Pipeline Dashboard — Specification

**Date:** 2026-05-08 (rewritten for Sales Pipeline Lite — supersedes the V1 8-section dashboard)
**Status:** Implemented
**Page:** `/sales-pipeline`
**Source of truth:** `apps/api/src/modules/reporting/reporting.service.ts` (`getSalesPipelineMetrics`), `apps/web/src/app/(app)/sales-pipeline/page.tsx`

This document defines what the sales pipeline dashboard shows, how each KPI is computed, and which roles see which numbers.

---

## 1. Purpose

Help Director, Sales Manager, and Sales Engineer answer one question:

> **What needs my attention today?**

The dashboard does **not** answer:

- "How much will we close this month?" (forecast pressure removed)
- "Who is the most active salesperson?" (ranking removed)
- "What's our weighted pipeline value?" (forecast removed)

If a section doesn't directly help someone decide what to do today, it's not on the dashboard.

---

## 2. Visibility

Visible in the sidebar to:

- `DIRECTOR`
- `SALES_MANAGER`
- `SALES_ENGINEER`

Not visible to other roles (PMO / project / procurement / O&M / finance use other dashboards).

The page route is gated by `getNavItemsForRole(...)` in `apps/web/src/lib/role-ui.ts`. The underlying reporting endpoint requires only authentication; data is filtered by the caller's `opportunity:view` scope (own / team / all).

### Sensitive-value display

Pipeline value (RM totals) is sensitive. Display layer respects the existing rules in `apps/web/src/lib/role-ui.ts`:

| Section | DIRECTOR | SALES_MANAGER | SALES_ENGINEER |
|---|---|---|---|
| Active-opportunities total value caption | ✅ shown | ✅ shown | ❌ hidden (count only) |
| Pipeline-by-stage `Value` column | ✅ shown | ✅ shown | ❌ hidden (column omitted) |
| All other counts | ✅ shown to all three roles |

> **Known limitation (V2 follow-up).** The API still returns the value figures regardless of role; the UI hides them client-side. Server-side filtering is tracked as a defence-in-depth follow-up. Documented in `docs/sales-pipeline-lite.md` § 7.

---

## 3. Layout — three sections

### 3.1 Five quick cards (top of page)

Each card shows a count, optional caption, and click-through link.

| Card | Definition | Click target |
|---|---|---|
| **Active opportunities** | `count where stage NOT IN (WON, LOST) AND isActive = true`, in user's scope. Caption shows total pipeline value (DIRECTOR / SALES_MANAGER only). | `/opportunities` |
| **No next action** | `count where nextAction IS NULL OR nextAction = ''`, live opps only | `/opportunities?noNextAction=true` |
| **Overdue follow-ups** | `count where nextActionStatus = PENDING AND nextActionDueDate < now`, live opps only | `/opportunities?overdueNextAction=true` |
| **Stale (30+ days)** | `count where stage NOT IN (WON, LOST) AND lastActivityAt is null OR > 30 days ago` | `/opportunities?noActivity30d=true` |
| **Proposals awaiting follow-up** | `count where stage IN (BUDGETARY_PROPOSAL, FIRM_PROPOSAL) AND no activity in past 7 days` | `/opportunities?proposalSubmitted=true` |

Tone:

- Green when 0 (good outcome)
- Amber when > 0 for "no next action" / "stale" / "proposals awaiting follow-up"
- Red when > 0 for "overdue follow-ups"
- Default neutral colour for "Active opportunities"

---

### 3.2 Pipeline-by-Stage breakdown

Single table, one row per stage in canonical order:

| Column | Type | Notes |
|---|---|---|
| Stage | text | enum value, underscores → spaces |
| Count | int | open opps only (excludes WON / LOST) |
| Value | RM | sum of `estimatedValue` per stage. **Hidden for SALES_ENGINEER.** |
| Distribution | bar | proportional to max count across stages |

No filter UI on this section — it's a calm orientation snapshot. To drill in, click "Open opportunities →" link in the section header.

---

### 3.3 Needs-attention table

The action surface. Lists opps that match either:

- `nextActionStatus = PENDING AND nextActionDueDate < now` (overdue), OR
- `nextAction IS NULL OR nextAction = ''` (no next action)

Limited to 20 rows. Sorted by `nextActionDueDate ASC` then `updatedAt ASC` (oldest neglect first).

| Column | Source |
|---|---|
| Code | `Opportunity.opportunityCode` (link to detail) |
| Title | `Opportunity.title` |
| Account | `Opportunity.account.name` |
| Owner | `Opportunity.owner.name` |
| Next action | `Opportunity.nextAction` — shown red if "— no next action —" |
| Due | `Opportunity.nextActionDueDate` + relative-time pill ("3d overdue" in red, "in 2d" neutral) |

Empty state: *"You're all caught up — no opportunities need attention right now."*

---

### 3.4 (Optional) Proposals-awaiting-follow-up table

Shown only when `proposalMonitoring.items.length > 0`. Compact, max 8 rows. Same shape as Needs Attention but filtered to proposal-stage opps with no activity in 7+ days.

If the count is 0, the section is hidden entirely (less visual noise on a quiet dashboard).

---

## 4. What's NOT on the Lite dashboard

These were on the V1 dashboard and **deliberately removed**:

| Removed | Why |
|---|---|
| Closing-this-month / closing-this-quarter forecast | Closing pressure not appropriate for our team size |
| Weighted pipeline value | Same reason |
| Activity volume by salesperson | Felt like ranking |
| Top 10 by value | Pulled focus toward big-deal worship |
| Per-week activity total | Surfaced via the bell + existing notifications instead |

The motto: **calm and operational**. Every removed section was checked against "does this directly help someone decide what to do today?" — they didn't.

---

## 5. API contract

```
GET /api/reporting/sales-pipeline
```

Authenticated; no extra permission required. Returns scope-filtered data based on the caller's `opportunity:view` permission scope.

Response:

```jsonc
{
  "pipelineSummary": {
    "totalActiveOpportunities": 23,
    "totalPipelineValue":       4_550_000,
    "weightedPipelineValue":    1_980_000,   // computed but not rendered in Lite UI
    "averageDealSize":          197_826      // computed but not rendered in Lite UI
  },
  "stageBreakdown":     [{ "stage": "LEAD", "count": 4, "value": 800_000 }, /* ... */],
  "followUpMonitoring": {
    "overdueNextActions":     3,
    "noNextAction":           5,
    "staleOpportunities30d":  2
  },
  "proposalMonitoring": {
    "proposalsAwaitingFollowup": 1,
    "items": [/* up to 20 opp summaries */]
  },
  "needsAttention":  [/* up to 20 opp summaries */],
  "topOpportunities": [/* up to 10 — present in payload, not rendered in Lite */],
  "wonThisMonth":     { "count": 2, "value": 480_000 },     // present, not rendered
  "generatedAt":      "2026-05-08T08:00:00.000Z"
}
```

`topOpportunities` and `wonThisMonth` remain in the payload for potential future use and existing list-page links; the Lite UI does not render them as dashboard sections.

`activitySummary` and `closingForecast` were **removed from the payload** (Q5/E1) — clean payload, no external consumers.

---

## 6. Refresh behaviour

- Server-fetched page (Next.js client component using `apiClient.get`).
- Re-fetches on focus.
- All numbers are point-in-time.

---

## 7. Out of scope for Lite (V2 candidates)

- **Pipeline by Owner** chart (one extra `groupBy: ownerUserId` query)
- **Server-side enforcement** of sensitive-value visibility
- **Date-range selectors** (currently hard-coded "live opps" / "this month")
- **Drill-down from chart click** into a filtered list (cards already drill in; charts don't)
- **Export to CSV** (use `/reports` for that)
