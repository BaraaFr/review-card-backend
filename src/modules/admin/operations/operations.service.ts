import {
    prisma,
  } from "../../../lib/prisma.js";
  
  import {
    requestRedis,
  } from "../../../lib/request-redis.js";
  
  import {
    env,
  } from "../../../config/env.js";
  
  import {
    getLimitUsage,
  } from "../../../middleware/shared-rate-limit.js";
  
  import {
    weeklyReportQueue,
  } from "../../weekly-reports/weekly-report.queue.js";
  
  import {
    subscriptionReminderQueue,
  } from "../../reminders/subscriptions/reminder.queue.js";
import { JobType } from "bullmq";
  
  type HealthSeverity =
    | "WARNING"
    | "CRITICAL";
  
  type HealthIssue = {
    code:
      string;
  
    severity:
      HealthSeverity;
  
    message:
      string;
  
    value?:
      number;
  };
  
  const STALE_AFTER_MS =
    15 *
    60 *
    1000;
  
  const QUEUE_WARNING =
    20;
  
  const QUEUE_CRITICAL =
    100;
  
  async function getQueueSnapshot(
    queue: {
      getJobCounts:
        (
          ...types:
            string[]
        ) =>
          Promise<
            Record<
              string,
              number
            >
          >;
    }
  ) {
    try {
      const counts =
        await queue
          .getJobCounts(
            "wait",
            "active",
            "delayed",
            "failed"
          );
  
      return {
        available:
          true,
  
        waiting:
          counts.wait ??
          0,
  
        active:
          counts.active ??
          0,
  
        delayed:
          counts.delayed ??
          0,
  
        failed:
          counts.failed ??
          0,
      };
    } catch {
      return {
        available:
          false,
  
        waiting:
          null,
  
        active:
          null,
  
        delayed:
          null,
  
        failed:
          null,
      };
    }
  }
  
  async function getRedisSnapshot() {
    try {
      const redis =
        await requestRedis();
  
      const response =
        await redis.ping();
  
      return {
        available:
          response ===
          "PONG",
      };
    } catch {
      return {
        available:
          false,
      };
    }
  }
  
  function addQueueIssues(
    name:
      string,
  
    queue: {
      available:
        boolean;
  
      waiting:
        number |
        null;
  
      delayed:
        number |
        null;
  
      failed:
        number |
        null;
    },
  
    issues:
      HealthIssue[]
  ) {
    if (
      !queue.available
    ) {
      issues.push({
        code:
          `${name}_QUEUE_UNAVAILABLE`,
  
        severity:
          "CRITICAL",
  
        message:
          `${name} queue is unavailable.`,
      });
  
      return;
    }
  
    if (
      (
        queue.failed ??
        0
      ) >
      0
    ) {
      issues.push({
        code:
          `${name}_DEAD_LETTERS`,
  
        severity:
          "CRITICAL",
  
        message:
          `${name} queue contains failed jobs requiring review.`,
  
        value:
          queue.failed ??
          0,
      });
    }
  
    const backlog =
      queue.waiting ??
      0;
  
    if (
      backlog >=
      QUEUE_CRITICAL
    ) {
      issues.push({
        code:
          `${name}_QUEUE_BACKLOG`,
  
        severity:
          "CRITICAL",
  
        message:
          `${name} queue has a large waiting backlog.`,
  
        value:
          backlog,
      });
    } else if (
      backlog >=
      QUEUE_WARNING
    ) {
      issues.push({
        code:
          `${name}_QUEUE_BACKLOG`,
  
        severity:
          "WARNING",
  
        message:
          `${name} queue backlog is growing.`,
  
        value:
          backlog,
      });
    }
  
    const delayed =
      queue.delayed ??
      0;
  
    if (
      delayed >=
      QUEUE_WARNING
    ) {
      issues.push({
        code:
          `${name}_DELAYED_BACKLOG`,
  
        severity:
          delayed >=
            QUEUE_CRITICAL
            ? "CRITICAL"
            : "WARNING",
  
        message:
          `${name} queue contains many delayed jobs.`,
  
        value:
          delayed,
      });
    }
  }
  
  export const operationsService = {
    async getHealth() {
      const now =
        new Date();
  
      const staleBefore =
        new Date(
          now.getTime() -
          STALE_AFTER_MS
        );
  
      /*
       * ===================================================
       * Durable database state
       * ===================================================
       */
  
      const [
        weeklyFailed,
  
        weeklyPending,
  
        weeklyProcessing,
  
        weeklyStalePending,
  
        weeklyStaleProcessing,
  
        emailUnknown,
  
        emailProcessing,
  
        emailStaleProcessing,
      ] =
        await Promise.all([
          prisma
            .weeklyReportDelivery
            .count({
              where: {
                status:
                  "FAILED",
              },
            }),
  
          prisma
            .weeklyReportDelivery
            .count({
              where: {
                status:
                  "PENDING",
              },
            }),
  
          prisma
            .weeklyReportDelivery
            .count({
              where: {
                status:
                  "PROCESSING",
              },
            }),
  
          prisma
            .weeklyReportDelivery
            .count({
              where: {
                status:
                  "PENDING",
  
                createdAt: {
                  lt:
                    staleBefore,
                },
              },
            }),
  
          prisma
            .weeklyReportDelivery
            .count({
              where: {
                status:
                  "PROCESSING",
  
                startedAt: {
                  lt:
                    staleBefore,
                },
              },
            }),
  
          prisma
            .emailDispatch
            .count({
              where: {
                status:
                  "UNKNOWN",
              },
            }),
  
          prisma
            .emailDispatch
            .count({
              where: {
                status:
                  "PROCESSING",
              },
            }),
  
          prisma
            .emailDispatch
            .count({
              where: {
                status:
                  "PROCESSING",
  
                startedAt: {
                  lt:
                    staleBefore,
                },
              },
            }),
        ]);
  
      /*
       * ===================================================
       * Runtime infrastructure
       * ===================================================
       */
  
      const [
        redis,
  
        weeklyQueue,
  
        reminderQueue,
      ] =
        await Promise.all([
          getRedisSnapshot(),
  
          getQueueSnapshot({
            getJobCounts: (...types: string[]) =>
              weeklyReportQueue.getJobCounts(...(types as JobType[])),
          }),
  
          getQueueSnapshot({
            getJobCounts: (...types: string[]) =>
              subscriptionReminderQueue.getJobCounts(...(types as JobType[])),
          }),
        ]);
  
      /*
       * ===================================================
       * Google quota
       * ===================================================
       */
  
      let googleBudget:
        Awaited<
          ReturnType<
            typeof getLimitUsage
          >
        > |
        null =
        null;
  
      try {
        googleBudget =
          await getLimitUsage(
            "google-upstream",
  
            "deployment",
  
            env
              .GOOGLE_API_DAILY_LIMIT
          );
      } catch {
        /*
         * Redis availability is already
         * reported separately.
         */
      }
  
      /*
       * ===================================================
       * Issues
       * ===================================================
       */
  
      const issues:
        HealthIssue[] =
        [];
  
      if (
        !redis.available
      ) {
        issues.push({
          code:
            "REDIS_UNAVAILABLE",
  
          severity:
            "CRITICAL",
  
          message:
            "Redis is unavailable.",
        });
      }
  
      addQueueIssues(
        "WEEKLY_REPORT",
        weeklyQueue,
        issues
      );
  
      addQueueIssues(
        "SUBSCRIPTION_REMINDER",
        reminderQueue,
        issues
      );
  
      if (
        weeklyFailed >
        0
      ) {
        issues.push({
          code:
            "WEEKLY_DELIVERY_FAILED",
  
          severity:
            "CRITICAL",
  
          message:
            "Weekly report deliveries require manual review.",
  
          value:
            weeklyFailed,
        });
      }
  
      if (
        weeklyStaleProcessing >
        0
      ) {
        issues.push({
          code:
            "WEEKLY_DELIVERY_STALE_PROCESSING",
  
          severity:
            "CRITICAL",
  
          message:
            "Weekly report deliveries are stuck in processing.",
  
          value:
            weeklyStaleProcessing,
        });
      }
  
      if (
        weeklyStalePending >
        0
      ) {
        issues.push({
          code:
            "WEEKLY_DELIVERY_STALE_PENDING",
  
          severity:
            "WARNING",
  
          message:
            "Weekly report deliveries have remained pending too long.",
  
          value:
            weeklyStalePending,
        });
      }
  
      if (
        emailUnknown >
        0
      ) {
        issues.push({
          code:
            "EMAIL_DELIVERY_UNKNOWN",
  
          severity:
            "CRITICAL",
  
          message:
            "Email deliveries have an uncertain SMTP outcome and require manual review.",
  
          value:
            emailUnknown,
        });
      }
  
      if (
        emailStaleProcessing >
        0
      ) {
        issues.push({
          code:
            "EMAIL_DISPATCH_STALE_PROCESSING",
  
          severity:
            "CRITICAL",
  
          message:
            "Email dispatches are stuck in processing.",
  
          value:
            emailStaleProcessing,
        });
      }
  
      if (
        googleBudget
      ) {
        if (
          googleBudget
            .percentage >=
          100
        ) {
          issues.push({
            code:
              "GOOGLE_BUDGET_EXHAUSTED",
  
            severity:
              "CRITICAL",
  
            message:
              "Google API daily budget is exhausted.",
  
            value:
              googleBudget
                .percentage,
          });
        } else if (
          googleBudget
            .percentage >=
          80
        ) {
          issues.push({
            code:
              "GOOGLE_BUDGET_HIGH",
  
            severity:
              "WARNING",
  
            message:
              "Google API daily budget usage is high.",
  
            value:
              googleBudget
                .percentage,
          });
        }
      }
  
      const status =
        issues.some(
          (
            issue
          ) =>
            issue.severity ===
            "CRITICAL"
        )
          ? "CRITICAL"
          : issues.length >
              0
            ? "WARNING"
            : "HEALTHY";
  
      return {
        generatedAt:
          now,
  
        status,
  
        dependencies: {
          redis,
        },
  
        queues: {
          weeklyReports:
            weeklyQueue,
  
          subscriptionReminders:
            reminderQueue,
        },
  
        weeklyReports: {
          failed:
            weeklyFailed,
  
          pending:
            weeklyPending,
  
          processing:
            weeklyProcessing,
  
          stalePending:
            weeklyStalePending,
  
          staleProcessing:
            weeklyStaleProcessing,
        },
  
        email: {
          unknown:
            emailUnknown,
  
          processing:
            emailProcessing,
  
          staleProcessing:
            emailStaleProcessing,
        },
  
        google: {
          budget:
            googleBudget,
        },
  
        issues,
      };
    },
  };