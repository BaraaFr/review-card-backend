import {
    Queue,
  } from "bullmq";
  
  import {
    createRedisConnection,
  } from "../../../lib/redis.js";
  
  export const SUBSCRIPTION_REMINDER_QUEUE =
    "valyou-subscription-reminders";
  
  export type SubscriptionReminderJobData = {
    subscriptionId:
      string;
  
    expiresAt:
      string;
  };
  
  type RecoveryOptions = {
    retryFailed?:
      boolean;
  
    retryCompleted?:
      boolean;
  };
  
  export type SubscriptionReminderQueueResult =
    | {
        action:
          "ENQUEUED";
  
        state:
          "waiting";
      }
    | {
        action:
          "EXISTS";
  
        state:
          string;
      }
    | {
        action:
          "RETRIED_FAILED";
  
        state:
          "waiting";
      }
    | {
        action:
          "RETRIED_COMPLETED";
  
        state:
          "waiting";
      }
    | {
        action:
          "DEAD";
  
        state:
          "failed";
  
        reason:
          string | null;
      };
  
  const queueConnection =
    createRedisConnection(
      "producer"
    );
  
  export const subscriptionReminderQueue =
    new Queue<SubscriptionReminderJobData>(
      SUBSCRIPTION_REMINDER_QUEUE,
  
      {
        connection:
          queueConnection,
      }
    );
  
  function getReminderJobId(
    subscriptionId:
      string,
  
    expiresAt:
      Date
  ) {
    return `subscription-expiry-${subscriptionId}-${expiresAt.getTime()}`;
  }
  
  async function addReminderJob(
    subscriptionId:
      string,
  
    expiresAt:
      Date
  ) {
    await subscriptionReminderQueue.add(
      "send-subscription-expiry-reminder",
  
      {
        subscriptionId,
  
        expiresAt:
          expiresAt.toISOString(),
      },
  
      {
        jobId:
          getReminderJobId(
            subscriptionId,
            expiresAt
          ),
  
        attempts:
          3,
  
        backoff: {
          type:
            "exponential",
  
          delay:
            30_000,
        },
  
        removeOnComplete:
          1000,
  
        /*
         * Keep failed jobs available
         * for inspection/recovery.
         */
        removeOnFail:
          1000,
      }
    );
  }
  
  export async function enqueueSubscriptionReminder(
    subscriptionId:
      string,
  
    expiresAt:
      Date,
  
    options:
      RecoveryOptions = {}
  ): Promise<SubscriptionReminderQueueResult> {
    const jobId =
      getReminderJobId(
        subscriptionId,
        expiresAt
      );
  
    const existing =
      await subscriptionReminderQueue
        .getJob(
          jobId
        );
  
    /*
     * Job disappeared from Redis,
     * or initial enqueue never succeeded.
     */
    if (
      !existing
    ) {
      await addReminderJob(
        subscriptionId,
        expiresAt
      );
  
      return {
        action:
          "ENQUEUED",
  
        state:
          "waiting",
      };
    }
  
    const state =
      await existing.getState();
  
    /*
     * Normal in-flight states.
     */
    if (
      state ===
        "active" ||
      state ===
        "waiting" ||
      state ===
        "delayed" ||
      state ===
        "prioritized" ||
      state ===
        "waiting-children"
    ) {
      return {
        action:
          "EXISTS",
  
        state,
      };
    }
  
    /*
     * =====================================================
     * Failed job
     * =====================================================
     */
  
    if (
      state ===
      "failed"
    ) {
      /*
       * Never create infinite automatic
       * retry cycles.
       */
      if (
        !options.retryFailed
      ) {
        return {
          action:
            "DEAD",
  
          state:
            "failed",
  
          reason:
            existing.failedReason ??
            null,
        };
      }
  
      try {
        await existing.retry(
          "failed",
  
          {
            resetAttemptsMade:
              true,
  
            resetAttemptsStarted:
              true,
          }
        );
      } catch (
        error
      ) {
        /*
         * Another worker/scheduler may
         * already have recovered it.
         */
        const latest =
          await existing.getState();
  
        if (
          latest ===
            "waiting" ||
          latest ===
            "delayed" ||
          latest ===
            "active"
        ) {
          return {
            action:
              "EXISTS",
  
            state:
              latest,
          };
        }
  
        throw error;
      }
  
      return {
        action:
          "RETRIED_FAILED",
  
        state:
          "waiting",
      };
    }
  
    /*
     * =====================================================
     * Completed queue job
     * =====================================================
     *
     * But subscription still says reminder
     * was not completed.
     *
     * Replay is safe because sendEmailOnce()
     * protects SMTP delivery.
     */
  
    if (
      state ===
        "completed" &&
      options.retryCompleted
    ) {
      try {
        await existing.retry(
          "completed",
  
          {
            resetAttemptsMade:
              true,
  
            resetAttemptsStarted:
              true,
          }
        );
      } catch (
        error
      ) {
        const latest =
          await existing.getState();
  
        if (
          latest ===
            "waiting" ||
          latest ===
            "delayed" ||
          latest ===
            "active"
        ) {
          return {
            action:
              "EXISTS",
  
            state:
              latest,
          };
        }
  
        throw error;
      }
  
      return {
        action:
          "RETRIED_COMPLETED",
  
        state:
          "waiting",
      };
    }
  
    return {
      action:
        "EXISTS",
  
      state,
    };
  }
  
  /*
   * Explicit operational/manual replay.
   *
   * Do not call this automatically for
   * arbitrary dead-letter jobs.
   */
  export async function replayFailedSubscriptionReminder(
    subscriptionId:
      string,
  
    expiresAt:
      Date
  ) {
    return enqueueSubscriptionReminder(
      subscriptionId,
      expiresAt,
  
      {
        retryFailed:
          true,
  
        retryCompleted:
          true,
      }
    );
  }