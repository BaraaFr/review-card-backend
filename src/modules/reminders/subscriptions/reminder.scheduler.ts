import {
  prisma,
} from "../../../lib/prisma.js";

import {
  enqueueSubscriptionReminder,
} from "./reminder.queue.js";

const DAY_MS =
  24 *
  60 *
  60 *
  1000;

const SCAN_INTERVAL_MS =
  60 *
  60 *
  1000;

let timer:
  NodeJS.Timeout |
  null =
  null;

let scanning =
  false;

export async function scanSubscriptionReminders() {
  if (
    scanning
  ) {
    return;
  }

  scanning =
    true;

  try {
    const now =
      new Date();

    const reminderWindowEnd =
      new Date(
        now.getTime() +
          5 *
            DAY_MS
      );

    const subscriptions =
      await prisma.subscription
        .findMany({
          where: {
            status: {
              in: [
                "TRIAL",
                "ACTIVE",
              ],
            },

            expiresAt: {
              gt:
                now,

              lte:
                reminderWindowEnd,
            },
          },

          select: {
            id:
              true,

            expiresAt:
              true,

            expiryReminderFor:
              true,
          },
        });

    for (
      const subscription
      of subscriptions
    ) {
      try {
        if (
          !subscription.expiresAt
        ) {
          continue;
        }

        /*
         * =================================================
         * Already completed
         * =================================================
         */

        if (
          subscription
            .expiryReminderFor &&
          subscription
            .expiryReminderFor
            .getTime() ===
            subscription
              .expiresAt
              .getTime()
        ) {
          continue;
        }

        /*
         * =================================================
         * Durable email identity
         * =================================================
         */

        const dispatchKey =
          `subscription-expiry:${subscription.id}:${subscription.expiresAt.getTime()}`;

        const emailDispatch =
          await prisma.emailDispatch
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
         * =================================================
         * Unknown SMTP outcome
         * =================================================
         *
         * Never automatically resend.
         *
         * PROCESSING could mean the worker
         * died somewhere around the SMTP call.
         *
         * UNKNOWN explicitly means we cannot
         * prove whether the provider accepted it.
         */

        if (
          emailDispatch
            ?.status ===
              "UNKNOWN" ||
          emailDispatch
            ?.status ===
              "PROCESSING"
        ) {
          console.error(
            "Subscription reminder delivery requires manual review",
            {
              subscriptionId:
                subscription.id,

              expiresAt:
                subscription
                  .expiresAt
                  .toISOString(),

              emailStatus:
                emailDispatch.status,
            }
          );

          continue;
        }

        /*
         * =================================================
         * Recovery
         * =================================================
         */

        const emailAlreadySent =
          emailDispatch
            ?.status ===
          "SENT";

        const result =
          await enqueueSubscriptionReminder(
            subscription.id,
            subscription.expiresAt,

            {
              /*
               * A failed job can only be
               * automatically replayed when
               * SMTP definitely succeeded.
               *
               * In that case the replay only
               * reconciles DB bookkeeping.
               */
              retryFailed:
                emailAlreadySent,

              /*
               * Completed BullMQ job but DB
               * reminder marker missing.
               *
               * Safe because sendEmailOnce()
               * prevents duplicate SMTP sends.
               */
              retryCompleted:
                true,
            }
          );

        /*
         * =================================================
         * Dead letter
         * =================================================
         */

        if (
          result.action ===
          "DEAD"
        ) {
          console.error(
            "Subscription reminder dead-lettered",
            {
              subscriptionId:
                subscription.id,

              expiresAt:
                subscription
                  .expiresAt
                  .toISOString(),

              reason:
                result.reason,
            }
          );
        }
      } catch (
        error
      ) {
        console.error(
          "Subscription reminder scheduling error",
          {
            subscriptionId:
              subscription.id,

            error,
          }
        );
      }
    }
  } finally {
    scanning =
      false;
  }
}

export function startSubscriptionReminderScheduler() {
  if (
    timer
  ) {
    return;
  }

  const scan =
    () => {
      void scanSubscriptionReminders()
        .catch(
          (
            error
          ) => {
            console.error(
              "Subscription reminder scan failed",
              error
            );
          }
        );
    };

  /*
   * Recovery immediately on worker startup.
   */
  scan();

  timer =
    setInterval(
      scan,
      SCAN_INTERVAL_MS
    );

  timer.unref?.();

  console.log(
    "Subscription reminder scheduler started"
  );
}

export async function stopSubscriptionReminderScheduler() {
  if (
    timer
  ) {
    clearInterval(
      timer
    );
  }

  timer =
    null;

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