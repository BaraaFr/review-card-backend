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

function subscription() {
  return {
    id:
      "sub-1",

    expiresAt:
      new Date(
        Date.now() +
          2 *
            24 *
            60 *
            60 *
            1000
      ),

    expiryReminderFor:
      null,
  };
}

test(
  "queues an eligible reminder when no durable email attempt exists",

  async () => {
    const row =
      subscription();

    let queued =
      0;

    const api =
      loadModule(
        "src/modules/reminders/subscriptions/reminder.scheduler.ts",

        {
          "../../../lib/prisma.js":
            {
              prisma: {
                subscription: {
                  findMany:
                    async () => [
                      row,
                    ],
                },

                emailDispatch: {
                  findUnique:
                    async () =>
                      null,
                },
              },
            },

          "./reminder.queue.js":
            {
              enqueueSubscriptionReminder:
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
      .scanSubscriptionReminders();

    assert.equal(
      queued,
      1
    );
  }
);

test(
  "does not replay reminder when SMTP outcome is uncertain",

  async (
    t
  ) => {
    t.mock.method(
      console,
      "error",
      () => {}
    );

    const row =
      subscription();

    let queued =
      0;

    const api =
      loadModule(
        "src/modules/reminders/subscriptions/reminder.scheduler.ts",

        {
          "../../../lib/prisma.js":
            {
              prisma: {
                subscription: {
                  findMany:
                    async () => [
                      row,
                    ],
                },

                emailDispatch: {
                  findUnique:
                    async () => ({
                      status:
                        "UNKNOWN",
                    }),
                },
              },
            },

          "./reminder.queue.js":
            {
              enqueueSubscriptionReminder:
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
      .scanSubscriptionReminders();

    /*
     * Critical protection.
     */
    assert.equal(
      queued,
      0
    );
  }
);

test(
  "allows failed reminder replay when email is already confirmed sent",

  async () => {
    const row =
      subscription();

    let optionsSeen =
      null;

    const api =
      loadModule(
        "src/modules/reminders/subscriptions/reminder.scheduler.ts",

        {
          "../../../lib/prisma.js":
            {
              prisma: {
                subscription: {
                  findMany:
                    async () => [
                      row,
                    ],
                },

                emailDispatch: {
                  findUnique:
                    async () => ({
                      status:
                        "SENT",
                    }),
                },
              },
            },

          "./reminder.queue.js":
            {
              enqueueSubscriptionReminder:
                async (
                  _id,
                  _expiresAt,
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
      .scanSubscriptionReminders();

    assert.ok(
      optionsSeen
    );

    assert.equal(
      optionsSeen
        .retryFailed,
      true
    );

    assert.equal(
      optionsSeen
        .retryCompleted,
      true
    );
  }
);

test(
  "does not schedule reminder already recorded for current expiration",

  async () => {
    const row =
      subscription();

    row.expiryReminderFor =
      new Date(
        row.expiresAt
      );

    let queued =
      0;

    let dispatchReads =
      0;

    const api =
      loadModule(
        "src/modules/reminders/subscriptions/reminder.scheduler.ts",

        {
          "../../../lib/prisma.js":
            {
              prisma: {
                subscription: {
                  findMany:
                    async () => [
                      row,
                    ],
                },

                emailDispatch: {
                  findUnique:
                    async () => {
                      dispatchReads++;

                      return null;
                    },
                },
              },
            },

          "./reminder.queue.js":
            {
              enqueueSubscriptionReminder:
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
      .scanSubscriptionReminders();

    assert.equal(
      queued,
      0
    );

    assert.equal(
      dispatchReads,
      0
    );
  }
);