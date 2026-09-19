const test =
  require(
    "node:test"
  );

const assert =
  require(
    "node:assert/strict"
  );

const {
  loadModule,
} =
  require(
    "./load-module.cjs"
  );

function prismaWith({
  weeklyFailed =
    0,

  weeklyPending =
    0,

  weeklyProcessing =
    0,

  weeklyStalePending =
    0,

  weeklyStaleProcessing =
    0,

  emailUnknown =
    0,

  emailProcessing =
    0,

  emailStaleProcessing =
    0,
} = {}) {
  return {
    weeklyReportDelivery: {
      count:
        async (
          {
            where,
          }: { where: { status: string; createdAt?: Date; startedAt?: Date } }
        ): Promise<number> => {
          if (
            where.status ===
              "FAILED"
          ) {
            return weeklyFailed;
          }

          if (
            where.status ===
              "PENDING" &&
            where.createdAt
          ) {
            return weeklyStalePending;
          }

          if (
            where.status ===
              "PROCESSING" &&
            where.startedAt
          ) {
            return weeklyStaleProcessing;
          }

          if (
            where.status ===
            "PENDING"
          ) {
            return weeklyPending;
          }

          if (
            where.status ===
            "PROCESSING"
          ) {
            return weeklyProcessing;
          }

          return 0;
        },
    },

    emailDispatch: {
      count:
        async (
          {
            where,
          }: { where: { status: string; startedAt?: Date } }
        ): Promise<number> => {
          if (
            where.status ===
              "UNKNOWN"
          ) {
            return emailUnknown;
          }

          if (
            where.status ===
              "PROCESSING" &&
            where.startedAt
          ) {
            return emailStaleProcessing;
          }

          if (
            where.status ===
            "PROCESSING"
          ) {
            return emailProcessing;
          }

          return 0;
        },
    },
  };
}

function queue(
  {
    wait =
      0,

    active =
      0,

    delayed =
      0,

    failed =
      0,
  } = {}
) {
  return {
    getJobCounts:
      async () => ({
        wait,

        active,

        delayed,

        failed,
      }),
  };
}

test(
  "operational health is healthy when durable and queue state are clean",

  async () => {
    const api =
      loadModule(
        "src/modules/admin/operations/operations.service.ts",

        {
          "../../../lib/prisma.js":
            {
              prisma:
                prismaWith(),
            },

          "../../../lib/request-redis.js":
            {
              requestRedis:
                async () => ({
                  ping:
                    async () =>
                      "PONG",
                }),
            },

          "../../../config/env.js":
            {
              env: {
                GOOGLE_API_DAILY_LIMIT:
                  200,
              },
            },

          "../../../middleware/shared-rate-limit.js":
            {
              getLimitUsage:
                async () => ({
                  limit:
                    200,

                  used:
                    20,

                  remaining:
                    180,

                  percentage:
                    10,

                  resetInSeconds:
                    1000,
                }),
            },

          "../../weekly-reports/weekly-report.queue.js":
            {
              weeklyReportQueue:
                queue(),
            },

          "../../reminders/subscriptions/reminder.queue.js":
            {
              subscriptionReminderQueue:
                queue(),
            },
        }
      );

    const result =
      await api
        .operationsService
        .getHealth();

    assert.equal(
      result.status,
      "HEALTHY"
    );

    assert.deepEqual(
      result.issues,
      []
    );
  }
);

test(
  "operational health becomes critical for dead letters or uncertain email",

  async () => {
    const api =
      loadModule(
        "src/modules/admin/operations/operations.service.ts",

        {
          "../../../lib/prisma.js":
            {
              prisma:
                prismaWith({
                  weeklyFailed:
                    1,

                  emailUnknown:
                    1,
                }),
            },

          "../../../lib/request-redis.js":
            {
              requestRedis:
                async () => ({
                  ping:
                    async () =>
                      "PONG",
                }),
            },

          "../../../config/env.js":
            {
              env: {
                GOOGLE_API_DAILY_LIMIT:
                  200,
              },
            },

          "../../../middleware/shared-rate-limit.js":
            {
              getLimitUsage:
                async () => ({
                  limit:
                    200,

                  used:
                    190,

                  remaining:
                    10,

                  percentage:
                    95,

                  resetInSeconds:
                    1000,
                }),
            },

          "../../weekly-reports/weekly-report.queue.js":
            {
              weeklyReportQueue:
                queue({
                  failed:
                    1,
                }),
            },

          "../../reminders/subscriptions/reminder.queue.js":
            {
              subscriptionReminderQueue:
                queue(),
            },
        }
      );

    const result =
      await api
        .operationsService
        .getHealth();

    assert.equal(
      result.status,
      "CRITICAL"
    );

    const codes =
      result.issues
        .map(
          (
            item: { code: any; }
          ) =>
            item.code
        );

    assert.ok(
      codes.includes(
        "WEEKLY_REPORT_DEAD_LETTERS"
      )
    );

    assert.ok(
      codes.includes(
        "WEEKLY_DELIVERY_FAILED"
      )
    );

    assert.ok(
      codes.includes(
        "EMAIL_DELIVERY_UNKNOWN"
      )
    );

    assert.ok(
      codes.includes(
        "GOOGLE_BUDGET_HIGH"
      )
    );
  }
);