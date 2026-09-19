import {
  startWeeklyReportWorker,
  stopWeeklyReportWorker,
} from "../weekly-reports/weekly-report.worker.js";

import {
  startWeeklyReportScheduler,
  stopWeeklyReportScheduler,
} from "../weekly-reports/weekly-report.scheduler.js";

import {
  startSubscriptionReminderWorker,
  stopSubscriptionReminderWorker,
} from "../reminders/subscriptions/reminder.worker.js";

import {
  startSubscriptionReminderScheduler,
  stopSubscriptionReminderScheduler,
} from "../reminders/subscriptions/reminder.scheduler.js";

import {
  weeklyReportQueue,
} from "../weekly-reports/weekly-report.queue.js";

import {
  subscriptionReminderQueue,
} from "../reminders/subscriptions/reminder.queue.js";

let started =
  false;

let starting:
  Promise<void> |
  null =
  null;

/*
 * =========================================================
 * Start
 * =========================================================
 *
 * Important:
 *
 * Workers are created first.
 *
 * Then we prove:
 *
 * - worker Redis connections are ready
 * - producer queue Redis connections are ready
 *
 * Only AFTER that do we start schedulers.
 *
 * This prevents:
 *
 * scheduler creates durable DB work
 * while the worker infrastructure
 * is not actually operational.
 */
export async function startBackgroundJobs() {
  if (
    started
  ) {
    return;
  }

  /*
   * Prevent two concurrent startup calls
   * from creating duplicate workers.
   */
  if (
    starting
  ) {
    return starting;
  }

  starting =
    (
      async () => {
        const weeklyWorker =
          startWeeklyReportWorker();

        const subscriptionWorker =
          startSubscriptionReminderWorker();

        try {
          /*
           * =================================================
           * Infrastructure readiness
           * =================================================
           */

          await Promise.all([
            weeklyWorker
              .waitUntilReady(),

            subscriptionWorker
              .waitUntilReady(),

            weeklyReportQueue
              .waitUntilReady(),

            subscriptionReminderQueue
              .waitUntilReady(),
          ]);

          /*
           * Only allow schedulers to create work
           * after queue infrastructure is ready.
           */
          startWeeklyReportScheduler();

          startSubscriptionReminderScheduler();

          started =
            true;

          console.log(
            "ValYou background jobs ready"
          );
        } catch (
          error
        ) {
          /*
           * Startup did not complete.
           *
           * Close everything that may have
           * partially started.
           */

          await Promise.allSettled([
            stopWeeklyReportScheduler(),

            stopSubscriptionReminderScheduler(),

            stopWeeklyReportWorker(),

            stopSubscriptionReminderWorker(),

            weeklyReportQueue
              .close(),

            subscriptionReminderQueue
              .close(),
          ]);

          started =
            false;

          throw error;
        }
      }
    )();

  try {
    await starting;
  } finally {
    starting =
      null;
  }
}

/*
 * =========================================================
 * Stop
 * =========================================================
 */

export async function stopBackgroundJobs() {
  /*
   * If shutdown arrives while startup is
   * still resolving, wait for it to settle.
   */
  if (
    starting
  ) {
    try {
      await starting;
    } catch {
      /*
       * Startup cleanup already ran.
       */
    }
  }

  /*
   * Stop schedulers first.
   *
   * No new jobs should be created while
   * workers are shutting down.
   */
  await Promise.all([
    stopWeeklyReportScheduler(),

    stopSubscriptionReminderScheduler(),
  ]);

  /*
   * Worker.close() allows currently
   * active processing to finish.
   */
  await Promise.all([
    stopWeeklyReportWorker(),

    stopSubscriptionReminderWorker(),
  ]);

  /*
   * Producer connections last.
   */
  await Promise.all([
    weeklyReportQueue
      .close(),

    subscriptionReminderQueue
      .close(),
  ]);

  started =
    false;
}