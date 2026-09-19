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
import { installFatalProcessHandlers } from "./lib/process-observability.js";

/*
 * Fail worker startup immediately
 * if required infrastructure is not
 * available/configured.
 */
try {
  installFatalProcessHandlers(
    "worker"
  );
  /*
   * Database must be reachable.
   */
  await prisma
    .$connect();

  /*
   * SMTP configuration and credentials
   * must be usable.
   */
  await verifyMailer();

  /*
   * BullMQ Redis connections must be
   * ready before startup succeeds.
   */
  await startBackgroundJobs();

  console.log(
    "ValYou worker started"
  );
} catch (
  error
) {
  console.error(
    "worker_startup_failed",
    error
  );

  /*
   * Clean up anything that may have
   * opened before startup failed.
   */
  try {
    await stopBackgroundJobs();
  } catch (
    cleanupError
  ) {
    console.error(
      "worker_startup_cleanup_failed",
      cleanupError
    );
  }

  closeMailer();

  closeRedisConnections();

  try {
    await prisma
      .$disconnect();
  } catch {
    /*
     * Startup is already failing.
     */
  }

  process.exit(
    1
  );
}

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