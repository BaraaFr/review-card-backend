import IORedis
  from "ioredis";

import {
  DomainError,
} from "./domain-error.js";

let client:
  InstanceType<
    typeof IORedis.default
  > |
  undefined;

let connecting:
  Promise<void> |
  undefined;

export async function requestRedis() {
  if (
    !client ||
    client.status ===
      "end"
  ) {
    const redisUrl =
      process.env
        .REDIS_URL;

    if (
      !redisUrl
    ) {
      throw new DomainError(
        503,
        "REDIS_UNAVAILABLE",
        "Service temporarily unavailable."
      );
    }

    client =
      new IORedis.default(
        redisUrl,

        {
          /*
           * Never let API requests
           * sit inside Redis offline
           * queues.
           */
          lazyConnect:
            true,

          enableOfflineQueue:
            false,

          maxRetriesPerRequest:
            1,

          connectTimeout:
            1500,

          commandTimeout:
            1500,

          retryStrategy:
            null,
        }
      );

    client.on(
      "error",
      () => {
        /*
         * Individual requests surface
         * a controlled 503.
         *
         * Do not log the Redis URL
         * because it may contain
         * credentials.
         */
      }
    );
  }

  if (
    client.status ===
      "wait" &&
    !connecting
  ) {
    connecting =
      client
        .connect()
        .finally(
          () => {
            connecting =
              undefined;
          }
        );
  }

  if (
    connecting
  ) {
    await connecting;
  }

  if (
    client.status !==
      "ready"
  ) {
    throw new DomainError(
      503,
      "REDIS_UNAVAILABLE",
      "Service temporarily unavailable."
    );
  }

  return client;
}

export function closeRequestRedis() {
  client
    ?.disconnect();

  client =
    undefined;
}