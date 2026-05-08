// Solaroo RE CRM — background worker
//
// V1 implementation deliberately avoids BullMQ + Redis:
//   - The Hobby Railway plan we deployed to does not have Redis available out of the box.
//   - Local dev has no Redis either — adding it would block onboarding for new contributors.
// Instead we run a `setInterval` loop. When the team adopts Redis, swap the loop body
// into a BullMQ scheduled job — the digest function itself stays untouched.

import { PrismaClient } from "@solaroo/db";

const prisma = new PrismaClient();

const DIGEST_TICK_MS  = 30 * 60 * 1000; // poll every 30 min
const DIGEST_WINDOW_H = 24;              // summarise last 24h of unread

/** Build + insert a daily digest notification for one user. */
async function buildDigestFor(userId: string, lastSentAt: Date | null): Promise<void> {
  const since = lastSentAt
    ? new Date(Math.max(lastSentAt.getTime(), Date.now() - DIGEST_WINDOW_H * 3600_000))
    : new Date(Date.now() - DIGEST_WINDOW_H * 3600_000);

  const unread = await prisma.notification.findMany({
    where: {
      userId,
      status: "UNREAD",
      createdAt: { gte: since },
      // Don't recursively summarise existing digests
      type: { not: "digest" },
    },
    select: { id: true, type: true, title: true },
  });

  if (unread.length === 0) {
    // Still update lastDigestSentAt so we don't reprobe constantly
    await prisma.user.update({
      where: { id: userId },
      data:  { lastDigestSentAt: new Date() },
    });
    return;
  }

  // Group by type for the body
  const byType: Record<string, number> = {};
  for (const n of unread) byType[n.type] = (byType[n.type] ?? 0) + 1;
  const breakdown = Object.entries(byType)
    .map(([t, c]) => `${c}× ${t.replace(/_/g, " ")}`)
    .join(" · ");

  await prisma.notification.create({
    data: {
      userId,
      title: `Daily digest — ${unread.length} unread notification${unread.length === 1 ? "" : "s"}`,
      body:  `${breakdown}. Open the bell or /notifications to review.`,
      type:  "digest",
      linkUrl: "/notifications",
      resource: null,
      resourceId: null,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data:  { lastDigestSentAt: new Date() },
  });

  console.log(`[digest] sent to user=${userId} (${unread.length} unread)`);
}

/** Scan all opted-in users; emit a digest if their last one is >= 24h ago. */
async function runDigestTick(): Promise<void> {
  const cutoff = new Date(Date.now() - DIGEST_WINDOW_H * 3600_000);
  const candidates = await prisma.user.findMany({
    where: {
      isActive: true,
      notificationDigestEnabled: true,
      OR: [
        { lastDigestSentAt: null },
        { lastDigestSentAt: { lte: cutoff } },
      ],
    },
    select: { id: true, lastDigestSentAt: true },
  });

  for (const u of candidates) {
    try {
      await buildDigestFor(u.id, u.lastDigestSentAt);
    } catch (err) {
      console.error(`[digest] failed for user=${u.id}:`, (err as Error).message);
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Sales pipeline notification ticks (V1)
//
// Three triggers — all in-app, all dedupe via the Notification table itself
// (don't add a new schema field; check whether we already created a matching
// notification within the last RECENT_DEDUPE_HOURS hours).
// ═════════════════════════════════════════════════════════════════════════════

const SALES_TICK_MS         = 60 * 60 * 1000;   // hourly
const RECENT_DEDUPE_HOURS   = 22;               // re-fire roughly once per day
// Sales Pipeline Lite (2026-05-08): calmer nudges.
//   Stale opps: 14 → 30 days (matches the health pill's STALE definition)
//   Proposal-stage chase: 3 → 7 days (still stage-aware, less anxious)
const NO_ACTIVITY_DAYS      = 30;
const PROPOSAL_NO_FOLLOWUP_DAYS = 7;

async function alreadyNotifiedRecently(opts: {
  userId: string;
  type: string;
  resource: string;
  resourceId: string;
}): Promise<boolean> {
  const cutoff = new Date(Date.now() - RECENT_DEDUPE_HOURS * 3600_000);
  const existing = await prisma.notification.findFirst({
    where: {
      userId:     opts.userId,
      type:       opts.type,
      resource:   opts.resource,
      resourceId: opts.resourceId,
      createdAt:  { gte: cutoff },
    },
    select: { id: true },
  });
  return !!existing;
}

async function notifyOnce(opts: {
  userId: string;
  title: string;
  body: string;
  type: string;
  resource: string;
  resourceId: string;
  linkUrl: string;
}): Promise<void> {
  if (await alreadyNotifiedRecently({ userId: opts.userId, type: opts.type, resource: opts.resource, resourceId: opts.resourceId })) return;
  await prisma.notification.create({
    data: {
      userId:     opts.userId,
      title:      opts.title,
      body:       opts.body,
      type:       opts.type,
      linkUrl:    opts.linkUrl,
      resource:   opts.resource,
      resourceId: opts.resourceId,
    },
  });
}

/** Tick 1: opps with overdue next actions → notify owner + nextActionOwner. */
async function tickOverdueNextActions(): Promise<void> {
  const now = new Date();
  const opps = await prisma.opportunity.findMany({
    where: {
      stage:             { notIn: ["WON", "LOST"] },
      nextActionStatus:  "PENDING",
      nextActionDueDate: { lt: now },
    },
    select: {
      id: true, opportunityCode: true, title: true, ownerUserId: true, nextActionOwnerId: true, nextAction: true,
    },
  });
  for (const o of opps) {
    const recipients = new Set<string>([o.ownerUserId]);
    if (o.nextActionOwnerId) recipients.add(o.nextActionOwnerId);
    for (const userId of recipients) {
      try {
        await notifyOnce({
          userId,
          title:      `Overdue next action — ${o.opportunityCode}`,
          body:       `${o.title} · ${o.nextAction ?? "(no description)"}`,
          type:       "next_action_overdue",
          resource:   "opportunity",
          resourceId: o.id,
          linkUrl:    `/opportunities/${o.id}`,
        });
      } catch (err) {
        console.error(`[sales] overdue notify failed for opp=${o.id}:`, (err as Error).message);
      }
    }
  }
  if (opps.length > 0) console.log(`[sales] tickOverdueNextActions: ${opps.length} opps processed`);
}

/** Tick 2: proposals submitted with no activity in last 3 days. */
async function tickProposalNoFollowup(): Promise<void> {
  const cutoff = new Date(Date.now() - PROPOSAL_NO_FOLLOWUP_DAYS * 86_400_000);
  const opps = await prisma.opportunity.findMany({
    where: {
      stage:      { in: ["BUDGETARY_PROPOSAL", "FIRM_PROPOSAL"] },
      activities: { none: { occurredAt: { gte: cutoff } } },
    },
    select: { id: true, opportunityCode: true, title: true, ownerUserId: true },
  });
  for (const o of opps) {
    try {
      await notifyOnce({
        userId:     o.ownerUserId,
        title:      `Proposal awaiting follow-up — ${o.opportunityCode}`,
        body:       `${o.title} · no activity logged in ${PROPOSAL_NO_FOLLOWUP_DAYS} days. Time to chase.`,
        type:       "proposal_no_followup",
        resource:   "opportunity",
        resourceId: o.id,
        linkUrl:    `/opportunities/${o.id}`,
      });
    } catch (err) {
      console.error(`[sales] proposal-followup notify failed for opp=${o.id}:`, (err as Error).message);
    }
  }
  if (opps.length > 0) console.log(`[sales] tickProposalNoFollowup: ${opps.length} opps processed`);
}

/** Tick 3: open opps with zero activity in 14 days. */
async function tickStaleOpportunities(): Promise<void> {
  const cutoff = new Date(Date.now() - NO_ACTIVITY_DAYS * 86_400_000);
  const opps = await prisma.opportunity.findMany({
    where: {
      stage:      { notIn: ["WON", "LOST"] },
      activities: { none: { occurredAt: { gte: cutoff } } },
    },
    select: { id: true, opportunityCode: true, title: true, ownerUserId: true },
  });
  for (const o of opps) {
    try {
      await notifyOnce({
        userId:     o.ownerUserId,
        title:      `No activity in ${NO_ACTIVITY_DAYS}+ days — ${o.opportunityCode}`,
        body:       `${o.title} · log a touchpoint or move the stage.`,
        type:       "opportunity_stale",
        resource:   "opportunity",
        resourceId: o.id,
        linkUrl:    `/opportunities/${o.id}`,
      });
    } catch (err) {
      console.error(`[sales] stale notify failed for opp=${o.id}:`, (err as Error).message);
    }
  }
  if (opps.length > 0) console.log(`[sales] tickStaleOpportunities: ${opps.length} opps processed`);
}

async function runSalesTicks(): Promise<void> {
  await tickOverdueNextActions().catch((e) => console.error("[sales] overdue tick failed", e));
  await tickProposalNoFollowup().catch((e) => console.error("[sales] proposal tick failed", e));
  await tickStaleOpportunities().catch((e) => console.error("[sales] stale tick failed", e));
}

async function main() {
  console.log(`Worker starting… digest interval = ${DIGEST_TICK_MS / 60000} min · sales interval = ${SALES_TICK_MS / 60000} min`);

  // Run once on boot, then on fixed intervals
  await runDigestTick().catch((e) => console.error("[digest] initial tick failed", e));
  await runSalesTicks().catch((e) => console.error("[sales] initial tick failed", e));
  setInterval(() => {
    runDigestTick().catch((e) => console.error("[digest] tick failed", e));
  }, DIGEST_TICK_MS);
  setInterval(() => {
    runSalesTicks().catch((e) => console.error("[sales] tick failed", e));
  }, SALES_TICK_MS);
}

main().catch((err) => {
  console.error("Worker fatal:", err);
  process.exit(1);
});
