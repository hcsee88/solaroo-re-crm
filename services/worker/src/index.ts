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

async function main() {
  console.log(`Worker starting… digest interval = ${DIGEST_TICK_MS / 60000} min`);

  // Run once on boot, then on a fixed interval
  await runDigestTick().catch((e) => console.error("[digest] initial tick failed", e));
  setInterval(() => {
    runDigestTick().catch((e) => console.error("[digest] tick failed", e));
  }, DIGEST_TICK_MS);
}

main().catch((err) => {
  console.error("Worker fatal:", err);
  process.exit(1);
});
