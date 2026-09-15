import {
    Worker,
  } from "bullmq";
import { SUBSCRIPTION_REMINDER_QUEUE, SubscriptionReminderJobData } from "./reminder.queue.js";
import { prisma } from "../../../lib/prisma.js";
import { isSubscriptionUsable } from "../../../utils/subscription.js";
import { buildSubscriptionReminderEmail } from "./email.template.js";
import { sendEmail } from "../../../lib/mailer.js";
import { createRedisConnection } from "../../../lib/redis.js";
  
  
  const DAY_MS =
    24 *
    60 *
    60 *
    1000;
  
  let worker:
    Worker<SubscriptionReminderJobData> |
    null =
    null;
  
  export function startSubscriptionReminderWorker() {
    if (
      worker
    ) {
      return worker;
    }
  
    worker =
      new Worker<SubscriptionReminderJobData>(
        SUBSCRIPTION_REMINDER_QUEUE,
  
        async (
          job
        ) => {
          const {
            subscriptionId,
            expiresAt:
              jobExpiresAtIso,
          } =
            job.data;
  
          const jobExpiresAt =
            new Date(
              jobExpiresAtIso
            );
  
          const subscription =
            await prisma.subscription.findUnique({
              where: {
                id:
                  subscriptionId,
              },
  
              select: {
                id:
                  true,
  
                status:
                  true,
  
                expiresAt:
                  true,
  
                expiryReminderFor:
                  true,
  
                business: {
                  select: {
                    name:
                      true,
  
                    owner: {
                      select: {
                        email:
                          true,
                      },
                    },
                  },
                },
              },
            });
  
          /*
           * Subscription removed.
           */
          if (
            !subscription
          ) {
            return;
          }
  
          /*
           * Subscription was renewed/edited
           * after this job was queued.
           *
           * Do not send a stale reminder.
           */
          if (
            !subscription.expiresAt ||
            subscription.expiresAt.getTime() !==
              jobExpiresAt.getTime()
          ) {
            return;
          }
  
          /*
           * Canceled / expired / past due
           * subscriptions should not receive
           * an upcoming-expiration reminder.
           */
          if (
            !isSubscriptionUsable(
              subscription
            )
          ) {
            return;
          }
  
          /*
           * Already sent for this expiration.
           */
          if (
            subscription.expiryReminderFor &&
            subscription.expiryReminderFor.getTime() ===
              subscription.expiresAt.getTime()
          ) {
            return;
          }
  
          const now =
            new Date();
  
          const remainingMs =
            subscription.expiresAt.getTime() -
            now.getTime();
  
          /*
           * It already expired before the job
           * executed.
           */
          if (
            remainingMs <=
            0
          ) {
            return;
          }
  
          const daysRemaining =
            Math.max(
              1,
  
              Math.ceil(
                remainingMs /
                  DAY_MS
              )
            );
  
          const email =
            buildSubscriptionReminderEmail({
              businessName:
                subscription.business.name,
  
              expiresAt:
                subscription.expiresAt,
  
              daysRemaining,
            });
  
          /*
           * Only mark the reminder as sent
           * AFTER SMTP succeeds.
           *
           * BullMQ will retry failures.
           */
          await sendEmail({
            to:
              subscription.business.owner.email,
  
            subject:
              email.subject,
  
            html:
              email.html,
  
            text:
              email.text,
  
            messageId:
              `<subscription-expiry-${subscription.id}-${subscription.expiresAt.getTime()}@valyou>`,
          });
  
          await prisma.subscription.update({
            where: {
              id:
                subscription.id,
            },
  
            data: {
              expiryReminderFor:
                subscription.expiresAt,
  
              expiryReminderSentAt:
                new Date(),
            },
          });
        },
  
        {
          connection:
            createRedisConnection(),
  
          concurrency:
            3,
        }
      );
  
    worker.on(
      "failed",
      (
        job,
        error
      ) => {
        console.error(
          "Subscription reminder job failed",
          {
            jobId:
              job?.id,
  
            error,
          }
        );
      }
    );
  
    worker.on(
      "completed",
      (
        job
      ) => {
        console.log(
          "Subscription reminder processed",
          {
            jobId:
              job.id,
          }
        );
      }
    );
  
    return worker;
  }