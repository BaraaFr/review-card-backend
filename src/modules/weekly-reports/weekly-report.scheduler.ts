import { prisma } from "../../lib/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { subscriptionService } from "../subscriptions/subscription.service.js";
import { enqueueWeeklyReportDelivery } from "./weekly-report.queue.js";
import { getDueScheduleKey, normalizeTimeZone } from "./weekly-report-time.util.js";

const STALE_PROCESSING_MS =
  15 *
  60 *
  1000;
const SCAN_INTERVAL_MS = 5 * 60 * 1000;
let timer: NodeJS.Timeout | null = null;
let scanning = false;
async function recoverDeliveries() {
  const now =
    new Date();

  const staleBefore =
    new Date(
      now.getTime() -
        STALE_PROCESSING_MS
    );

  let cursor:
    string |
    undefined;

  while (
    true
  ) {
    const deliveries =
      await prisma
        .weeklyReportDelivery
        .findMany({
          where: {
            OR: [
              /*
               * DB row committed but queue enqueue
               * may have failed.
               */
              {
                status:
                  "PENDING",
              },

              /*
               * Worker may have died after marking
               * the delivery PROCESSING.
               */
              {
                status:
                  "PROCESSING",

                startedAt: {
                  lt:
                    staleBefore,
                },
              },

              /*
               * Some FAILED jobs can be safely
               * reconciled when EmailDispatch says
               * SMTP already succeeded.
               */
              {
                status:
                  "FAILED",
              },
            ],
          },

          orderBy: {
            id:
              "asc",
          },

          take:
            100,

          ...(cursor
            ? {
                cursor: {
                  id:
                    cursor,
                },

                skip:
                  1,
              }
            : {}),

          select: {
            id:
              true,

            businessId:
              true,

            kind:
              true,

            status:
              true,

            startedAt:
              true,

            business: {
              select: {
                weeklyReportEnabled:
                  true,
              },
            },
          },
        });

    if (
      deliveries.length ===
      0
    ) {
      return;
    }

    for (
      const delivery
      of deliveries
    ) {
      try {
        /*
         * =================================================
         * No longer eligible
         * =================================================
         */

        if (
          delivery.kind ===
            "WEEKLY" &&
          !delivery.business
            .weeklyReportEnabled
        ) {
          await prisma
            .weeklyReportDelivery
            .update({
              where: {
                id:
                  delivery.id,
              },

              data: {
                status:
                  "SKIPPED",

                error:
                  "Weekly reports were disabled before delivery completed.",
              },
            });

          continue;
        }

        const subscription =
          await subscriptionService
            .getCurrentForBusiness(
              delivery.businessId
            );

        if (
          !subscription
            ?.usable
        ) {
          await prisma
            .weeklyReportDelivery
            .update({
              where: {
                id:
                  delivery.id,
              },

              data: {
                status:
                  "SKIPPED",

                error:
                  "Subscription was no longer usable before delivery completed.",
              },
            });

          continue;
        }

        /*
         * =================================================
         * Email state
         * =================================================
         */

        const dispatchKey =
          `weekly-report:${delivery.id}`;

        const emailDispatch =
          await prisma
            .emailDispatch
            .findUnique({
              where: {
                dispatchKey,
              },

              select: {
                status:
                  true,
              },
            });

        /*
         * PROCESSING or UNKNOWN means we cannot prove
         * whether SMTP accepted the previous message.
         *
         * Never automatically resend.
         */
        if (
          emailDispatch
            ?.status ===
            "UNKNOWN" ||
          emailDispatch
            ?.status ===
            "PROCESSING"
        ) {
          await prisma
            .weeklyReportDelivery
            .update({
              where: {
                id:
                  delivery.id,
              },

              data: {
                status:
                  "FAILED",

                failedAt:
                  new Date(),

                error:
                  "EMAIL_DELIVERY_UNCERTAIN",
              },
            });

          continue;
        }

        /*
         * If EmailDispatch is SENT:
         *
         * SMTP definitely succeeded.
         *
         * A failed queue job may safely be replayed
         * because sendEmailOnce() will skip SMTP.
         */
        const emailAlreadySent =
          emailDispatch
            ?.status ===
          "SENT";

        const result =
          await enqueueWeeklyReportDelivery(
            delivery.id,

            {
              retryFailed:
                emailAlreadySent,

              /*
               * Completed BullMQ job + unfinished DB
               * is inconsistent, but replay is safe.
               */
              retryCompleted:
                true,
            }
          );

        /*
         * Real dead-letter.
         *
         * Do not start another automatic retry cycle.
         */
        if (
          result.action ===
          "DEAD"
        ) {
          /*
           * It may already be FAILED.
           *
           * update() also keeps the latest reason useful.
           */
          await prisma
            .weeklyReportDelivery
            .update({
              where: {
                id:
                  delivery.id,
              },

              data: {
                status:
                  "FAILED",

                failedAt:
                  new Date(),

                error:
                  (
                    result.reason
                      ? `QUEUE_RETRIES_EXHAUSTED: ${result.reason}`
                      : "QUEUE_RETRIES_EXHAUSTED"
                  ).slice(
                    0,
                    2000
                  ),
              },
            });

          continue;
        }

        /*
         * =================================================
         * Stale PROCESSING recovery
         * =================================================
         *
         * If the job is now waiting/delayed again,
         * return the durable DB state to PENDING.
         */

        if (
          delivery.status ===
            "PROCESSING" &&
          (
            result.action ===
              "ENQUEUED" ||
            result.action ===
              "RETRIED_FAILED" ||
            result.action ===
              "RETRIED_COMPLETED" ||
            (
              result.action ===
                "EXISTS" &&
              (
                result.state ===
                  "waiting" ||
                result.state ===
                  "delayed"
              )
            )
          )
        ) {
          await prisma
            .weeklyReportDelivery
            .update({
              where: {
                id:
                  delivery.id,
              },

              data: {
                status:
                  "PENDING",

                startedAt:
                  null,

                failedAt:
                  null,

                error:
                  null,
              },
            });
        }
      } catch (
        error
      ) {
        console.error(
          "Weekly report recovery failed",
          {
            deliveryId:
              delivery.id,

            error,
          }
        );
      }
    }

    cursor =
      deliveries[
        deliveries.length -
          1
      ].id;

    if (
      deliveries.length <
      100
    ) {
      return;
    }
  }
}

export async function scanWeeklyReports() {
  if (scanning) return;
  scanning = true;
  try {
    // Recovery does not depend on still being inside the original schedule
    // window. A database row survives an unavailable Redis instance.
    await recoverDeliveries();
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
