const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./load-module.cjs');

test('recovers a committed delivery after enqueue fails, even outside its schedule window', async (t) => {
  t.mock.method(console, 'error', () => { });
  let row = null, available = false, due = true, creates = 0;
  const queued = new Set();
  const api = loadModule('src/modules/weekly-reports/weekly-report.scheduler.ts', {
    '../../lib/prisma.js': {
      prisma: {
        weeklyReportDelivery: {
          findMany: async () => row?.status === 'PENDING' ? [row] : [],
          create: async ({ data }) => {
            creates++;
            row = { ...data, id: 'delivery', business: { weeklyReportEnabled: true } };
            return row;
          },
        },
        emailDispatch: {
          findUnique:
            async () =>
              null,
        },
        business: { findMany: async () => [{ id: 'b', owner: { email: 'owner@example.com' } }] },
      }
    },
    '../../../generated/prisma/client.js': { Prisma: { PrismaClientKnownRequestError: class extends Error { } } },
    '../subscriptions/subscription.service.js': { subscriptionService: { getCurrentForBusiness: async () => ({ usable: true }) } },
    './weekly-report-time.util.js': { normalizeTimeZone: () => 'UTC', getDueScheduleKey: () => due ? '2026-09-14' : null },
    "./weekly-report.queue.js": {
      enqueueWeeklyReportDelivery:
        async (
          id
        ) => {
          if (
            !available
          ) {
            throw new Error(
              "Redis unavailable"
            );
          }

          queued.add(
            id
          );

          return {
            action:
              "ENQUEUED",

            state:
              "waiting",
          };
        },
    },
  });
  await api.scanWeeklyReports();
  assert.equal(row.status, 'PENDING');
  assert.equal(queued.size, 0);
  available = true;
  due = false;
  await api.scanWeeklyReports();
  await api.scanWeeklyReports();
  assert.deepEqual([...queued], ['delivery']);
  assert.equal(creates, 1);
  row.status = 'SENT';
  await api.scanWeeklyReports();
  assert.equal(queued.size, 1);
});

test('scan lock is released after database failure', async () => {
  let reads = 0;
  const api = loadModule('src/modules/weekly-reports/weekly-report.scheduler.ts', {
    '../../lib/prisma.js': {
      prisma: {
        weeklyReportDelivery: {
          findMany: async () => {
            reads++;
            throw new Error('database unavailable');
          }
        }
      }
    },
    '../../../generated/prisma/client.js': { Prisma: {} },
    '../subscriptions/subscription.service.js': { subscriptionService: {} },
    './weekly-report.queue.js': {},
  });
  await assert.rejects(api.scanWeeklyReports(), /database unavailable/);
  await assert.rejects(api.scanWeeklyReports(), /database unavailable/);
  assert.equal(reads, 2);
});

test(
  "recovers stale PROCESSING delivery when no email attempt exists",

  async (
    t
  ) => {
    t.mock.method(
      console,
      "error",
      () => {}
    );

    let row = {
      id:
        "delivery",

      businessId:
        "b",

      kind:
        "WEEKLY",

      status:
        "PROCESSING",

      startedAt:
        new Date(
          Date.now() -
            60 *
              60 *
              1000
        ),

      business: {
        weeklyReportEnabled:
          true,
      },
    };

    let queued =
      0;

    const api =
      loadModule(
        "src/modules/weekly-reports/weekly-report.scheduler.ts",

        {
          "../../lib/prisma.js": {
            prisma: {
              weeklyReportDelivery: {
                findMany:
                  async () =>
                    row
                      ? [
                          row,
                        ]
                      : [],

                update:
                  async (
                    {
                      data,
                    }
                  ) => {
                    Object.assign(
                      row,
                      data
                    );

                    return row;
                  },

                create:
                  async () => {
                    throw new Error(
                      "create should not be called"
                    );
                  },
              },

              emailDispatch: {
                findUnique:
                  async () =>
                    null,
              },

              business: {
                findMany:
                  async () =>
                    [],
              },
            },
          },

          "../../../generated/prisma/client.js":
            {
              Prisma: {
                PrismaClientKnownRequestError:
                  class extends Error {},
              },
            },

          "../subscriptions/subscription.service.js":
            {
              subscriptionService:
                {
                  getCurrentForBusiness:
                    async () => ({
                      usable:
                        true,
                    }),
                },
            },

          "./weekly-report-time.util.js":
            {
              normalizeTimeZone:
                () =>
                  "UTC",

              getDueScheduleKey:
                () =>
                  null,
            },

          "./weekly-report.queue.js":
            {
              enqueueWeeklyReportDelivery:
                async () => {
                  queued++;

                  return {
                    action:
                      "ENQUEUED",

                    state:
                      "waiting",
                  };
                },
            },
        }
      );

    await api
      .scanWeeklyReports();

    assert.equal(
      queued,
      1
    );

    assert.equal(
      row.status,
      "PENDING"
    );

    assert.equal(
      row.startedAt,
      null
    );
  }
);

test(
  "does not replay stale delivery when email outcome is uncertain",

  async (
    t
  ) => {
    t.mock.method(
      console,
      "error",
      () => {}
    );

    let row = {
      id:
        "delivery",

      businessId:
        "b",

      kind:
        "WEEKLY",

      status:
        "PROCESSING",

      startedAt:
        new Date(
          Date.now() -
            60 *
              60 *
              1000
        ),

      business: {
        weeklyReportEnabled:
          true,
      },
    };

    let queued =
      0;

    const api =
      loadModule(
        "src/modules/weekly-reports/weekly-report.scheduler.ts",

        {
          "../../lib/prisma.js": {
            prisma: {
              weeklyReportDelivery: {
                findMany:
                  async () => [
                    row,
                  ],

                update:
                  async (
                    {
                      data,
                    }
                  ) => {
                    Object.assign(
                      row,
                      data
                    );

                    return row;
                  },
              },

              emailDispatch: {
                findUnique:
                  async () => ({
                    status:
                      "UNKNOWN",
                  }),
              },

              business: {
                findMany:
                  async () =>
                    [],
              },
            },
          },

          "../../../generated/prisma/client.js":
            {
              Prisma: {
                PrismaClientKnownRequestError:
                  class extends Error {},
              },
            },

          "../subscriptions/subscription.service.js":
            {
              subscriptionService:
                {
                  getCurrentForBusiness:
                    async () => ({
                      usable:
                        true,
                    }),
                },
            },

          "./weekly-report.queue.js":
            {
              enqueueWeeklyReportDelivery:
                async () => {
                  queued++;

                  return {
                    action:
                      "ENQUEUED",

                    state:
                      "waiting",
                  };
                },
            },
        }
      );

    await api
      .scanWeeklyReports();

    /*
     * Absolutely critical:
     *
     * do not risk duplicate SMTP delivery.
     */
    assert.equal(
      queued,
      0
    );

    assert.equal(
      row.status,
      "FAILED"
    );

    assert.equal(
      row.error,
      "EMAIL_DELIVERY_UNCERTAIN"
    );
  }
);

test(
  "replays failed delivery when email was already sent so bookkeeping can finish",

  async (
    t
  ) => {
    t.mock.method(
      console,
      "error",
      () => {}
    );

    const row = {
      id:
        "delivery",

      businessId:
        "b",

      kind:
        "WEEKLY",

      status:
        "FAILED",

      startedAt:
        new Date(),

      business: {
        weeklyReportEnabled:
          true,
      },
    };

    let optionsSeen =
      null;

    const api =
      loadModule(
        "src/modules/weekly-reports/weekly-report.scheduler.ts",

        {
          "../../lib/prisma.js": {
            prisma: {
              weeklyReportDelivery: {
                findMany:
                  async () => [
                    row,
                  ],

                update:
                  async () =>
                    row,
              },

              emailDispatch: {
                findUnique:
                  async () => ({
                    status:
                      "SENT",
                  }),
              },

              business: {
                findMany:
                  async () =>
                    [],
              },
            },
          },

          "../../../generated/prisma/client.js":
            {
              Prisma: {
                PrismaClientKnownRequestError:
                  class extends Error {},
              },
            },

          "../subscriptions/subscription.service.js":
            {
              subscriptionService:
                {
                  getCurrentForBusiness:
                    async () => ({
                      usable:
                        true,
                    }),
                },
            },

          "./weekly-report.queue.js":
            {
              enqueueWeeklyReportDelivery:
                async (
                  _id,
                  options
                ) => {
                  optionsSeen =
                    options;

                  return {
                    action:
                      "RETRIED_FAILED",

                    state:
                      "waiting",
                  };
                },
            },
        }
      );

    await api
      .scanWeeklyReports();

    assert.equal(
      optionsSeen
        .retryFailed,
      true
    );
  }
);
