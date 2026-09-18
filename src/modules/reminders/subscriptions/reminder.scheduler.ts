import { prisma } from "../../../lib/prisma.js";
import { enqueueSubscriptionReminder } from "./reminder.queue.js";

  
  const DAY_MS =
    24 *
    60 *
    60 *
    1000;
  
  /*
   * Scan every hour.
   *
   * Expiration itself does NOT depend
   * on this scheduler.
   *
   * This is only for reminder email.
   */
  const SCAN_INTERVAL_MS =
    60 *
    60 *
    1000;
  
  let timer:
    NodeJS.Timeout | null =
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
  
      /*
       * Find usable subscription statuses
       * expiring within the next five days.
       *
       * If the server was temporarily down
       * exactly five days before expiration,
       * the reminder will still be sent when
       * the scheduler comes back before expiry.
       */
      const subscriptions =
        await prisma.subscription.findMany({
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
           * Already successfully reminded
           * for this exact expiration.
           */
          if (
            subscription.expiryReminderFor &&
            subscription.expiryReminderFor.getTime() ===
              subscription.expiresAt.getTime()
          ) {
            continue;
          }
  
          await enqueueSubscriptionReminder(
            subscription.id,
            subscription.expiresAt
          );
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
        void scanSubscriptionReminders().catch(
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
     * Run immediately on server start.
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
  