import {
  Queue,
} from "bullmq";

import {
  createRedisConnection,
} from "../../lib/redis.js";

export const WEEKLY_REPORT_QUEUE =
  "valyou-weekly-reports";

export type WeeklyReportJobData = {
  deliveryId:
    string;
};

type RecoveryOptions = {
  retryFailed?:
    boolean;

  retryCompleted?:
    boolean;
};

export type WeeklyReportQueueResult =
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

export const weeklyReportQueue =
  new Queue<WeeklyReportJobData>(
    WEEKLY_REPORT_QUEUE,

    {
      connection:
        queueConnection,
    }
  );

function getWeeklyReportJobId(
  deliveryId:
    string
) {
  return `weekly-report-${deliveryId}`;
}

async function addWeeklyReportJob(
  deliveryId:
    string
) {
  await weeklyReportQueue.add(
    "send-weekly-report",

    {
      deliveryId,
    },

    {
      jobId:
        getWeeklyReportJobId(
          deliveryId
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
       * Keep failed jobs so they remain
       * available for inspection/replay.
       */
      removeOnFail:
        1000,
    }
  );
}

/*
 * =========================================================
 * Ensure delivery exists in BullMQ
 * =========================================================
 *
 * This is stronger than blindly queue.add().
 *
 * Scenarios:
 *
 * DB row exists + Redis enqueue failed
 *   -> add the missing job
 *
 * Redis lost the job
 *   -> add it again
 *
 * Job is waiting/delayed/active
 *   -> leave it alone
 *
 * Job exhausted retries
 *   -> DEAD unless caller explicitly permits replay
 *
 * Job completed but DB says unfinished
 *   -> optionally replay so DB bookkeeping can reconcile
 *
 * EmailDispatch makes replay safe:
 * SENT -> SMTP is skipped on replay.
 */
export async function enqueueWeeklyReportDelivery(
  deliveryId:
    string,

  options:
    RecoveryOptions = {}
): Promise<WeeklyReportQueueResult> {
  const jobId =
    getWeeklyReportJobId(
      deliveryId
    );

  const existing =
    await weeklyReportQueue
      .getJob(
        jobId
      );

  /*
   * Job disappeared from Redis,
   * or was never successfully queued.
   */
  if (
    !existing
  ) {
    await addWeeklyReportJob(
      deliveryId
    );

    return {
      action:
        "ENQUEUED",

      state:
        "waiting",
    };
  }

  const state =
    await existing
      .getState();

  /*
   * Normal in-flight states.
   *
   * Do not interfere.
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
   * Failed / dead-letter job
   * =====================================================
   */

  if (
    state ===
    "failed"
  ) {
    if (
      !options.retryFailed
    ) {
      return {
        action:
          "DEAD",

        state:
          "failed",

        reason:
          existing
            .failedReason ??
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
       * Another worker/scheduler instance may
       * have retried it between getState()
       * and retry().
       *
       * Re-check before treating it as failure.
       */

      const latest =
        await existing
          .getState();

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
   * Completed queue job but DB still unfinished
   * =====================================================
   *
   * This should be rare.
   *
   * Because sendEmailOnce() is idempotent,
   * replaying a completed job will NOT send
   * SMTP twice if the EmailDispatch is SENT.
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
        await existing
          .getState();

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
 * =========================================================
 * Explicit dead-letter replay
 * =========================================================
 *
 * This is NOT used automatically for every failed job.
 *
 * Later we'll expose this through an operational/admin
 * command.
 */
export async function replayFailedWeeklyReportDelivery(
  deliveryId:
    string
) {
  return enqueueWeeklyReportDelivery(
    deliveryId,

    {
      retryFailed:
        true,

      retryCompleted:
        true,
    }
  );
}