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

export function startBackgroundJobs() {
  if (
    started
  ) {
    return;
  }

  started =
    true;

  startWeeklyReportWorker();

  startSubscriptionReminderWorker();

  startWeeklyReportScheduler();

  startSubscriptionReminderScheduler();

  console.log(
    "ValYou background jobs started"
  );
}

export async function stopBackgroundJobs() {
  await Promise.all([
    stopWeeklyReportScheduler(),

    stopSubscriptionReminderScheduler(),
  ]);

  await Promise.all([
    stopWeeklyReportWorker(),

    stopSubscriptionReminderWorker(),
  ]);

  await Promise.all([
    weeklyReportQueue.close(),

    subscriptionReminderQueue.close(),
  ]);

  started =
    false;
}