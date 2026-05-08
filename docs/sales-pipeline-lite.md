# Sales Pipeline Lite — Scope Decision

**Date:** 2026-05-08
**Status:** Active
**Supersedes (in scope, not in file):** the original V1 ambition documented in `docs/sales-activity-v1.md`, `docs/opportunity-health-rules.md`, `docs/sales-dashboard-v1.md`. Those V1 docs have been **rewritten in place** to reflect Lite — there's only one current version of each.

---

## 1. Why "Lite"

The original V1 plan layered seven phases of sales-pipeline functionality on top of an already-strong project-lifecycle CRM. After review the team concluded:

- The CRM already has many strong backend modules. Adding more visible features risks making the system feel **bulky and intimidating** for daily users.
- Sales discipline doesn't need a heavy task system, weighted-forecast dashboard, or stage-aware health gradients. It needs a **calm operating rhythm**: log activity, set the next action, do the next action.
- The CRM should feel like a **helpful operating system**, not a stressful reporting tool.

So this sprint dialled back V1 into a deliberately lighter version that protects the core value (visibility + discipline) and removes things that create pressure or visual noise.

---

## 2. What Lite includes

### 2.1 Manual sales activity logging

Activities are short, manual records of what happened with a customer. They are NOT integrated with email / WhatsApp / telephony / calendar / AI in V1.

Activity types:

- Call · Email · WhatsApp · Meeting · Site Visit · Proposal Follow-up · General Note

Required fields: opportunity (required), account / contact / site (optional), type, subject, note, occurred-at, owner.

UI: timeline embedded on opportunity detail page (also account, contact, site detail). Newest first. Quick-add button. Same-day-only edit window. Delete by creator + Sales Manager + Director.

### 2.2 Next-action discipline

Every active opportunity should have ONE open next action.

Fields: `nextAction` (free text), `nextActionType` (FOLLOW_UP / SITE_SURVEY / REVISED_QUOTATION / CLIENT_MEETING / INTERNAL_REVIEW / OTHER), `nextActionDueDate`, `nextActionOwnerId`, `nextActionStatus` (PENDING / COMPLETED / CANCELLED).

UI: Next-Action card prominent on opportunity detail. Mark Done. Quick-add new. No heavy task system.

### 2.3 Three-state health (no "At Risk")

| State | When | Tone |
|---|---|---|
| **Healthy** | Open next action with future due date AND activity within 30 days | green |
| **Overdue** | Open next action whose due date has passed | red |
| **Stale** | No activity in > 30 days | amber, labelled "Needs follow-up" in UI |

Priority: Overdue > Stale > Healthy. Computed at read time, never stored. See `docs/opportunity-health-rules.md`.

### 2.4 Opportunity list filters

Kept (calm):
- My opportunities
- Designed by me
- No next action
- Overdue follow-up
- Stale 30 days
- Proposal submitted
- High value (≥1M)
- Won this month · Lost this month
- Won (all-time) · Lost (all-time)

Saved-Views model unchanged. Pre-Lite saved views with removed-filter keys still load (the API silently strips unknown keys); the missing chip simply doesn't apply.

### 2.5 Sales pipeline dashboard at `/sales-pipeline`

Five quick cards + Pipeline-by-Stage breakdown + Needs-Attention table (+ small Proposals-Awaiting-Follow-up table when non-empty).

Five cards: Active opportunities · No next action · Overdue follow-ups · Stale (30+ days) · Proposals awaiting follow-up.

Visible to DIRECTOR / SALES_MANAGER / SALES_ENGINEER. Pipeline value figures hidden from SALES_ENGINEER per existing `apps/web/src/lib/role-ui.ts` rules.

### 2.6 In-app notifications

Three triggers, all in-app only via the existing `Notification` table + worker:

| Trigger | Threshold | Routed to |
|---|---|---|
| `next_action_overdue` | due-date past | action owner + opp owner |
| `proposal_no_followup` | 7 days no activity (was 3 in V1) on proposal-stage opp | opp owner |
| `opportunity_stale` | 30 days no activity (was 14 in V1) on live opp | opp owner |

The proposal nudge stays stage-aware via the worker (Q8/H2). The health pill itself is a uniform 30-day STALE threshold.

---

## 3. What Lite explicitly excludes

| Item | Why removed |
|---|---|
| `AT_RISK` health state | Created amber noise without actionable signal — most opps with 7-14d silence still had future-dated next actions and were fine. |
| `Closing this month` / `Closing this quarter` filter chips | Created closing pressure. We're a 15-person engineering business, not a SaaS sales team. |
| Closing forecast section on dashboard | Same reason. |
| Weighted forecast section on dashboard | Same reason. |
| Activity volume per salesperson on dashboard | Felt like ranking. The bell + notifications already nudge individuals; a public leaderboard isn't needed. |
| Top 10 by value section on dashboard | Pulled toward big-deal worship. The Pipeline-by-Stage breakdown gives the same orientation without the highlight reel. |
| `noActivity 14d` filter chip | 14-day pressure cut; only the 30-day "Stale" remains. |
| Stage-aware health gradient (e.g. proposal stages = 7d STALE) | Health pill stays uniform 30d. The worker still nudges proposal-stage opps at 7 days — discipline without visual pressure. |

---

## 4. What Lite explicitly does NOT build

Restated from the manual-only product decision:

- ❌ Email integration (Gmail / Outlook / IMAP / SMTP)
- ❌ WhatsApp integration (Meta Business API)
- ❌ Telephony / call integration
- ❌ Calendar integration (Google / Outlook)
- ❌ AI automation (auto-summary, auto-next-action)
- ❌ RAG / vector search
- ❌ Threaded comments on activities
- ❌ Attachments on activities (use Documents module)

These are documented as deferred in `docs/v1-product-direction.md` § Post-V1 Priorities. They may be re-considered after the manual rhythm proves the workflow has product-market fit.

---

## 5. UX principles (calm, role-based, practical)

For pages touched in this sprint (opportunity list, opportunity detail, sales dashboard):

- **Information hierarchy:** Status → Owner → Next Action → Due Date → Last Activity → Linked Proposal/Account. Move secondary info lower.
- **Compact rows on lists** (~40px row height) so a manager can see 15+ opps without scrolling.
- **Prefer cards or compact summary panels** over dense reporting tables.
- **Light row highlighting** for `Overdue` / `No next action` / `Stale`. Avoid noisy colour coding.
- **Tone of copy:** "Needs follow-up" not "Failed follow-up", "Add update" not "Mandatory log entry", no "salesperson ranking" / "poor performance" wording anywhere.
- **Empty states** are friendly, not blank ("You're all caught up — no opportunities need attention right now.").

The dashboard motto: **calm and operational**. If a chart doesn't directly answer "what should I do today?", it doesn't belong.

---

## 6. Decision log (Q&A from sprint planning)

| Q | Decision | Why |
|---|---|---|
| Q1 — handle 33ea21e (the V1 commit shipped earlier today) | Layer Lite on top; rewrite V1 docs in place | Cleanest history; one current version of each spec doc |
| Q2 — `tickProposalNoFollowup` worker tick | Keep, extend 3 → 7 days | Discipline without urgency |
| Q3 — Won / Lost filter naming | Keep `Won this month` / `Lost this month` AND add all-time `Won` / `Lost` | Two valid use cases; chip clutter is acceptable |
| Q4 — High-value (≥1M) filter | Keep | Useful, doesn't add pressure |
| Q5 — `closingForecast` + `activitySummary` in API payload | Remove | Cleaner payload, no external consumers |
| Q6 — saved views referencing removed filters | Silent drop | Lowest friction; documented here for trail |
| Q7 — UI/UX scope | Tight: 3 specific changes (list row tighten, detail re-order verified, dashboard 5+1+1) | Predictable scope |
| Q8 — stage-aware stale threshold | Worker only; health pill uniform | Smart nudging without pill confusion |
| Q9 — server-side sensitive-value enforcement on dashboard API | Defer to V2 | Out of scope for a UI/UX sprint |
| Q10 — doc strategy | Rewrite V1 docs in place; add this `sales-pipeline-lite.md` as umbrella | One current version per topic |
| Q11 — migration for removed `AT_RISK` | Silent (health is computed, never stored) | Nothing to migrate |
| Q12 — health enum naming | Keep `STALE`; UI label "Needs follow-up" | Minimal code churn; tone in UI |

---

## 7. Out-of-scope follow-ups (V2 candidates)

1. **Pipeline by Owner** chart on `/sales-pipeline` (added back if managers ask for it; one `groupBy` query)
2. **Server-side sensitive-value enforcement** on `getSalesPipelineMetrics()` (defence-in-depth)
3. **Unit tests** for `opportunity-health.ts` (pure function — quick to add)
4. **Mobile site supervisor UX** — quick activity logger optimised for phone
5. **Demo fixture data** — realistic accounts/sites/opps/activities seed
6. **`OpportunityNextAction` history table** — current model overwrites prior next action when status flips
7. **Activity export** to CSV
8. **O&M module** (item 9 of the original build sequence; the next big module after sales discipline is comfortable)

---

## 8. Files touched in the Lite sprint

Code:

- `apps/api/src/modules/opportunities/opportunity-health.ts` — 3-state health, 30d threshold
- `apps/api/src/modules/opportunities/opportunities.dto.ts` — `won` / `lost` filters added
- `apps/api/src/modules/opportunities/opportunities.service.ts` — wire `won` / `lost` filters
- `apps/api/src/modules/reporting/reporting.service.ts` — payload trimmed; `needsAttention` table added; `proposalMonitoring.items` exposed
- `services/worker/src/index.ts` — `NO_ACTIVITY_DAYS` 14→30, `PROPOSAL_NO_FOLLOWUP_DAYS` 3→7
- `packages/types/src/index.ts` — `OpportunityHealth` union narrowed; `EffectiveNextActionStatus` widened with `CANCELLED`
- `apps/web/src/components/opportunities/health-badge.tsx` — 3 states, "Needs follow-up" label, legacy-AT_RISK shim
- `apps/web/src/app/(app)/opportunities/page.tsx` — chip set updated; row padding tightened; saved-view restore array updated
- `apps/web/src/app/(app)/sales-pipeline/page.tsx` — rewritten for Lite (5 cards + by-stage + needs-attention)

Docs:

- `docs/sales-pipeline-lite.md` (this file) — NEW umbrella scope decision
- `docs/sales-activity-v1.md` — touched (status mapping confirmed)
- `docs/opportunity-health-rules.md` — rewritten for 3-state 30d
- `docs/sales-dashboard-v1.md` — rewritten for Lite scope
- `CLAUDE.md` — Lite-scope callout under the lifecycle line
- `dev_log/dev_log_260508.txt` — appended Lite section
