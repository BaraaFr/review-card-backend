import IORedis
  from "ioredis";

const connections =
  new Set<
    InstanceType<
      typeof IORedis.default
    >
  >();

export function createRedisConnection(
  mode:
    | "worker"
    | "producer" =
    "worker"
) {
  const redisUrl =
    process.env
      .REDIS_URL;

  if (
    !redisUrl
  ) {
    throw new Error(
      "REDIS_URL is required"
    );
  }

  const connection =
    new IORedis.default(
      redisUrl,

      mode ===
        "worker"
        ? {
            /*
             * BullMQ workers require
             * unlimited command retries.
             */
            maxRetriesPerRequest:
              null,

            connectTimeout:
              3000,
          }
        : {
            /*
             * API producer operations
             * must fail quickly instead
             * of hanging requests.
             */
            maxRetriesPerRequest:
              1,

            enableOfflineQueue:
              false,

            connectTimeout:
              1500,

            commandTimeout:
              1500,
          }
    );

  connection.on(
    "error",

    () => {
      console.warn(
        "queue_redis_unavailable",
        {
          mode,
        }
      );
    }
  );

  connections.add(
    connection
  );

  return connection;
}

export function closeRedisConnections() {
  for (
    const connection
    of connections
  ) {
    connection.disconnect();
  }

  connections.clear();
}