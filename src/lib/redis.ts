import IORedis from "ioredis";

export function createRedisConnection() {
  const redisUrl =
    process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error(
      "REDIS_URL is required"
    );
  }

  return new IORedis.default(
    redisUrl,
    {
      maxRetriesPerRequest:
        null,
    }
  );
}