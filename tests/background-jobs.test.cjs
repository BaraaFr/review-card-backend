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

test(
  "schedulers start only after workers and queues are ready",

  async () => {
    const events =
      [];

    const weeklyWorker = {
      waitUntilReady:
        async () => {
          events.push(
            "weekly-worker-ready"
          );
        },
    };

    const reminderWorker = {
      waitUntilReady:
        async () => {
          events.push(
            "reminder-worker-ready"
          );
        },
    };

    const api =
      loadModule(
        "src/modules/queues/background-jobs.ts",

        {
          "../weekly-reports/weekly-report.worker.js":
            {
              startWeeklyReportWorker:
                () => {
                  events.push(
                    "weekly-worker-start"
                  );

                  return weeklyWorker;
                },

              stopWeeklyReportWorker:
                async () => {
                  events.push(
                    "weekly-worker-stop"
                  );
                },
            },

          "../weekly-reports/weekly-report.scheduler.js":
            {
              startWeeklyReportScheduler:
                () => {
                  events.push(
                    "weekly-scheduler-start"
                  );
                },

              stopWeeklyReportScheduler:
                async () => {
                  events.push(
                    "weekly-scheduler-stop"
                  );
                },
            },

          "../reminders/subscriptions/reminder.worker.js":
            {
              startSubscriptionReminderWorker:
                () => {
                  events.push(
                    "reminder-worker-start"
                  );

                  return reminderWorker;
                },

              stopSubscriptionReminderWorker:
                async () => {
                  events.push(
                    "reminder-worker-stop"
                  );
                },
            },

          "../reminders/subscriptions/reminder.scheduler.js":
            {
              startSubscriptionReminderScheduler:
                () => {
                  events.push(
                    "reminder-scheduler-start"
                  );
                },

              stopSubscriptionReminderScheduler:
                async () => {
                  events.push(
                    "reminder-scheduler-stop"
                  );
                },
            },

          "../weekly-reports/weekly-report.queue.js":
            {
              weeklyReportQueue: {
                waitUntilReady:
                  async () => {
                    events.push(
                      "weekly-queue-ready"
                    );
                  },

                close:
                  async () => {
                    events.push(
                      "weekly-queue-close"
                    );
                  },
              },
            },

          "../reminders/subscriptions/reminder.queue.js":
            {
              subscriptionReminderQueue:
                {
                  waitUntilReady:
                    async () => {
                      events.push(
                        "reminder-queue-ready"
                      );
                    },

                  close:
                    async () => {
                      events.push(
                        "reminder-queue-close"
                      );
                    },
                },
            },
        }
      );

    await api
      .startBackgroundJobs();

    const weeklySchedulerIndex =
      events.indexOf(
        "weekly-scheduler-start"
      );

    const reminderSchedulerIndex =
      events.indexOf(
        "reminder-scheduler-start"
      );

    assert.ok(
      weeklySchedulerIndex >
        events.indexOf(
          "weekly-worker-ready"
        )
    );

    assert.ok(
      weeklySchedulerIndex >
        events.indexOf(
          "weekly-queue-ready"
        )
    );

    assert.ok(
      reminderSchedulerIndex >
        events.indexOf(
          "reminder-worker-ready"
        )
    );

    assert.ok(
      reminderSchedulerIndex >
        events.indexOf(
          "reminder-queue-ready"
        )
    );

    await api
      .stopBackgroundJobs();
  }
);

test(
    "background startup fails cleanly when Redis/BullMQ is unavailable",
  
    async (
      t
    ) => {
      t.mock.method(
        console,
        "error",
        () => {}
      );
  
      let weeklySchedulerStarts =
        0;
  
      let reminderSchedulerStarts =
        0;
  
      let weeklyWorkerStops =
        0;
  
      let reminderWorkerStops =
        0;
  
      let queuesClosed =
        0;
  
      const api =
        loadModule(
          "src/modules/queues/background-jobs.ts",
  
          {
            "../weekly-reports/weekly-report.worker.js":
              {
                startWeeklyReportWorker:
                  () => ({
                    waitUntilReady:
                      async () => {
                        throw new Error(
                          "Redis unavailable"
                        );
                      },
                  }),
  
                stopWeeklyReportWorker:
                  async () => {
                    weeklyWorkerStops++;
                  },
              },
  
            "../weekly-reports/weekly-report.scheduler.js":
              {
                startWeeklyReportScheduler:
                  () => {
                    weeklySchedulerStarts++;
                  },
  
                stopWeeklyReportScheduler:
                  async () => {},
              },
  
            "../reminders/subscriptions/reminder.worker.js":
              {
                startSubscriptionReminderWorker:
                  () => ({
                    waitUntilReady:
                      async () => {},
                  }),
  
                stopSubscriptionReminderWorker:
                  async () => {
                    reminderWorkerStops++;
                  },
              },
  
            "../reminders/subscriptions/reminder.scheduler.js":
              {
                startSubscriptionReminderScheduler:
                  () => {
                    reminderSchedulerStarts++;
                  },
  
                stopSubscriptionReminderScheduler:
                  async () => {},
              },
  
            "../weekly-reports/weekly-report.queue.js":
              {
                weeklyReportQueue: {
                  waitUntilReady:
                    async () => {},
  
                  close:
                    async () => {
                      queuesClosed++;
                    },
                },
              },
  
            "../reminders/subscriptions/reminder.queue.js":
              {
                subscriptionReminderQueue:
                  {
                    waitUntilReady:
                      async () => {},
  
                    close:
                      async () => {
                        queuesClosed++;
                      },
                  },
              },
          }
        );
  
      await assert.rejects(
        api.startBackgroundJobs(),
  
        /Redis unavailable/
      );
  
      /*
       * Schedulers MUST NOT start when queue
       * infrastructure isn't ready.
       */
      assert.equal(
        weeklySchedulerStarts,
        0
      );
  
      assert.equal(
        reminderSchedulerStarts,
        0
      );
  
      /*
       * Partial startup must be cleaned.
       */
      assert.equal(
        weeklyWorkerStops,
        1
      );
  
      assert.equal(
        reminderWorkerStops,
        1
      );
  
      assert.equal(
        queuesClosed,
        2
      );
    }
  );

  test(
    "background jobs cannot be started twice",
  
    async () => {
      let weeklyWorkers =
        0;
  
      let reminderWorkers =
        0;
  
      let weeklySchedulers =
        0;
  
      let reminderSchedulers =
        0;
  
      const api =
        loadModule(
          "src/modules/queues/background-jobs.ts",
  
          {
            "../weekly-reports/weekly-report.worker.js":
              {
                startWeeklyReportWorker:
                  () => {
                    weeklyWorkers++;
  
                    return {
                      waitUntilReady:
                        async () => {},
                    };
                  },
  
                stopWeeklyReportWorker:
                  async () => {},
              },
  
            "../weekly-reports/weekly-report.scheduler.js":
              {
                startWeeklyReportScheduler:
                  () => {
                    weeklySchedulers++;
                  },
  
                stopWeeklyReportScheduler:
                  async () => {},
              },
  
            "../reminders/subscriptions/reminder.worker.js":
              {
                startSubscriptionReminderWorker:
                  () => {
                    reminderWorkers++;
  
                    return {
                      waitUntilReady:
                        async () => {},
                    };
                  },
  
                stopSubscriptionReminderWorker:
                  async () => {},
              },
  
            "../reminders/subscriptions/reminder.scheduler.js":
              {
                startSubscriptionReminderScheduler:
                  () => {
                    reminderSchedulers++;
                  },
  
                stopSubscriptionReminderScheduler:
                  async () => {},
              },
  
            "../weekly-reports/weekly-report.queue.js":
              {
                weeklyReportQueue: {
                  waitUntilReady:
                    async () => {},
  
                  close:
                    async () => {},
                },
              },
  
            "../reminders/subscriptions/reminder.queue.js":
              {
                subscriptionReminderQueue:
                  {
                    waitUntilReady:
                      async () => {},
  
                    close:
                      async () => {},
                  },
              },
          }
        );
  
      await Promise.all([
        api.startBackgroundJobs(),
        api.startBackgroundJobs(),
        api.startBackgroundJobs(),
      ]);
  
      assert.equal(
        weeklyWorkers,
        1
      );
  
      assert.equal(
        reminderWorkers,
        1
      );
  
      assert.equal(
        weeklySchedulers,
        1
      );
  
      assert.equal(
        reminderSchedulers,
        1
      );
  
      await api
        .stopBackgroundJobs();
    }
  );