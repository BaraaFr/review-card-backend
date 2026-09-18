import app
  from "./app.js";

import {
  env,
} from "./config/env.js";

import {
  prisma,
} from "./lib/prisma.js";

import {
  closeRedisConnections,
} from "./lib/redis.js";

import {
  closeRequestRedis,
} from "./lib/request-redis.js";

import {
  weeklyReportQueue,
} from "./modules/weekly-reports/weekly-report.queue.js";

import {
  subscriptionReminderQueue,
} from "./modules/reminders/subscriptions/reminder.queue.js";

const server =
  app.listen(
    env.PORT,

    () => {
      console.log(
        `ValYou API listening on port ${env.PORT}`
      );
    }
  );

/*
 * Bound slow/stuck HTTP traffic.
 */
server.requestTimeout =
  30_000;

server.headersTimeout =
  10_000;

let closing =
  false;

async function shutdown() {
  if (
    closing
  ) {
    return;
  }

  closing =
    true;

  const timeout =
    setTimeout(
      () => {
        console.error(
          "api_shutdown_timeout"
        );

        server
          .closeAllConnections();

        process.exit(
          1
        );
      },

      30_000
    );

  timeout.unref?.();

  try {
    /*
     * Stop accepting new requests,
     * while allowing existing ones
     * to complete.
     */
    await new Promise<void>(
      (
        resolve,
        reject
      ) => {
        server.close(
          (
            error
          ) => {
            if (
              error
            ) {
              reject(
                error
              );

              return;
            }

            resolve();
          }
        );
      }
    );

    /*
     * API process owns BullMQ
     * producer connections because
     * queue dashboard/routes import
     * the Queue objects.
     */
    await Promise.all([
      weeklyReportQueue
        .close(),

      subscriptionReminderQueue
        .close(),
    ]);

    closeRedisConnections();

    closeRequestRedis();

    await prisma
      .$disconnect();

    clearTimeout(
      timeout
    );

    process.exit(
      0
    );
  } catch (
    error
  ) {
    console.error(
      "api_shutdown_failed",
      error
    );

    process.exit(
      1
    );
  }
}

process.once(
  "SIGTERM",
  shutdown
);

process.once(
  "SIGINT",
  shutdown
);