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

const queueConnection =
  createRedisConnection("producer");

export const weeklyReportQueue =
  new Queue<WeeklyReportJobData>(
    WEEKLY_REPORT_QUEUE,
    {
      connection:
        queueConnection,
    }
  );

export async function enqueueWeeklyReportDelivery(
  deliveryId: string
) {
  await weeklyReportQueue.add(
    "send-weekly-report",
    {
      deliveryId,
    },
    {
      jobId:
        `weekly-report-${deliveryId}`,

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

      removeOnFail:
        1000,
    }
  );
}