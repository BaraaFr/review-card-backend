import { prisma } from "../../lib/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { subscriptionService } from "../subscriptions/subscription.service.js";
import { enqueueWeeklyReportDelivery } from "./weekly-report.queue.js";
import { getDueScheduleKey, normalizeTimeZone } from "./weekly-report-time.util.js";

const SCAN_INTERVAL_MS = 5 * 60 * 1000;
let timer: NodeJS.Timeout | null = null;
let scanning = false;

async function recoverPendingDeliveries() {
  let cursor: string | undefined;
  while (true) {
    const deliveries = await prisma.weeklyReportDelivery.findMany({
      where: { status: "PENDING" },
      orderBy: { id: "asc" },
      take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true, businessId: true, kind: true,
        business: { select: { weeklyReportEnabled: true } },
      },
    });
    if (deliveries.length === 0) return;
    for (const delivery of deliveries) {
      try {
        if (delivery.kind === "WEEKLY" && !delivery.business.weeklyReportEnabled) continue;
        const subscription = await subscriptionService.getCurrentForBusiness(delivery.businessId);
        if (!subscription?.usable) continue;
        // The queue's deterministic job ID makes re-enqueueing a pending job
        // harmless even when another instance already queued it.
        await enqueueWeeklyReportDelivery(delivery.id);
      } catch (error) {
        console.error("Weekly report enqueue recovery failed", { deliveryId: delivery.id, error });
      }
    }
    cursor = deliveries[deliveries.length - 1].id;
    if (deliveries.length < 100) return;
  }
}

export async function scanWeeklyReports() {
  if (scanning) return;
  scanning = true;
  try {
    // Recovery does not depend on still being inside the original schedule
    // window. A database row survives an unavailable Redis instance.
    await recoverPendingDeliveries();
    const now = new Date();
    const businesses = await prisma.business.findMany({
      where: { weeklyReportEnabled: true },
      select: {
        id: true, weeklyReportDay: true, weeklyReportTime: true,
        weeklyReportTimeZone: true, weeklyReportEmail: true,
        owner: { select: { email: true } },
      },
    });
    for (const business of businesses) {
      try {
        const subscription = await subscriptionService.getCurrentForBusiness(business.id);
        if (!subscription?.usable) continue;
        const scheduleKey = getDueScheduleKey({
          now, day: business.weeklyReportDay, time: business.weeklyReportTime,
          timeZone: normalizeTimeZone(business.weeklyReportTimeZone),
        });
        if (!scheduleKey) continue;
        const recipient = business.weeklyReportEmail?.trim() || business.owner.email;
        if (!recipient) continue;

        try {
          const delivery = await prisma.weeklyReportDelivery.create({
            data: { businessId: business.id, kind: "WEEKLY", scheduleKey, recipient, status: "PENDING" },
          });
          await enqueueWeeklyReportDelivery(delivery.id);
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            // The existing pending delivery is handled by the recovery scan.
            continue;
          }
          throw error;
        }
      } catch (error) {
        console.error("Weekly report scheduling error", { businessId: business.id, error });
      }
    }
  } finally {
    scanning = false;
  }
}

export function startWeeklyReportScheduler() {
  if (timer) return;
  const scan = () => {
    void scanWeeklyReports().catch((error) => {
      console.error("Weekly report scan failed", error);
    });
  };
  scan();
  timer = setInterval(scan, SCAN_INTERVAL_MS);
  timer.unref?.();
  console.log("Weekly report scheduler started");
}

export async function stopWeeklyReportScheduler() {
  if (
    timer
  ) {
    clearInterval(
      timer
    );
  }

  timer =
    null;

  /*
   * Don't exit halfway through
   * a scheduling scan.
   */
  while (
    scanning
  ) {
    await new Promise(
      (
        resolve
      ) =>
        setTimeout(
          resolve,
          25
        )
    );
  }
}
