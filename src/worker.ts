import "./config/env.js";

import {
  prisma,
} from "./lib/prisma.js";

import {
  verifyMailer,
  closeMailer,
} from "./lib/mailer.js";

import {
  closeRedisConnections,
} from "./lib/redis.js";

import {
  startBackgroundJobs,
  stopBackgroundJobs,
} from "./modules/queues/background-jobs.js";

/*
 * Fail worker startup immediately
 * if required infrastructure is not
 * available/configured.
 */
await prisma
  .$connect();

await verifyMailer();

startBackgroundJobs();

console.log(
  "ValYou worker started"
);

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
          "worker_shutdown_timeout"
        );

        process.exit(
          1
        );
      },

      30_000
    );

  timeout.unref?.();

  try {
    await stopBackgroundJobs();

    closeMailer();

    closeRedisConnections();

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
      "worker_shutdown_failed",
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