import {
    startWeeklyReportWorker,
  } from "../weekly-reports/weekly-report.worker.js";
  
  import {
    startWeeklyReportScheduler,
  } from "../weekly-reports/weekly-report.scheduler.js";
import { startSubscriptionReminderWorker } from "../reminders/subscriptions/reminder.worker.js";
import { startSubscriptionReminderScheduler } from "../reminders/subscriptions/reminder.scheduler.js";
  
  /*
   * =======================================================
   * Background Jobs Bootstrap
   * =======================================================
   *
   * Starts all BullMQ workers and background schedulers
   * used by ValYou.
   *
   * app.ts should only call this function once.
   * =======================================================
   */
  
  let started =
    false;
  
  export function startBackgroundJobs() {
    /*
     * Prevent accidental duplicate startup
     * inside the same Node process.
     */
    if (
      started
    ) {
      return;
    }
  
    started =
      true;
  
    /*
     * =====================================================
     * Weekly Reports
     * =====================================================
     */
  
    startWeeklyReportWorker();
  
    startWeeklyReportScheduler();
  
    /*
     * =====================================================
     * Subscription Expiry Reminders
     * =====================================================
     */
  
    startSubscriptionReminderWorker();
  
    startSubscriptionReminderScheduler();
  
    console.log(
      "ValYou background jobs started"
    );
  }