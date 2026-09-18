const test =
  require(
    "node:test"
  );

const assert =
  require(
    "node:assert/strict"
  );

const {
  randomUUID,
  createHash,
} =
  require(
    "node:crypto"
  );

const Redis =
  require(
    "ioredis"
  );

const {
  loadModule,
} =
  require(
    "../load-module.cjs"
  );

const testUrl ="redis://localhost:6379/15";

test(
  "Redis atomically enforces shared limits across concurrent requests",

  {
    skip:
      !testUrl,
  },

  async (
    t
  ) => {
    /*
     * Protect against accidentally
     * pointing this test at a remote
     * or production Redis server.
     */
    const parsed =
      new URL(
        testUrl
      );

    assert.ok(
      [
        "localhost",
        "127.0.0.1",
        "[::1]",
      ].includes(
        parsed.hostname
      ),

      "TEST_REDIS_URL must be local."
    );

    assert.equal(
      parsed.protocol,
      "redis:"
    );

    assert.equal(
      parsed.pathname,
      "/15",

      "Use isolated Redis database 15 for tests."
    );

    const oldRedisUrl =
      process.env
        .REDIS_URL;

    /*
     * Production requestRedis reads
     * REDIS_URL. Point it at the
     * explicitly isolated test Redis
     * for this process.
     */
    process.env.REDIS_URL =
      testUrl;

    const namespace =
      `phase2-${randomUUID()}`;

    const subject =
      `client-${randomUUID()}`;

    const hash =
      createHash(
        "sha256"
      )
        .update(
          subject
        )
        .digest(
          "hex"
        );

    const expectedKey =
      `valyou:limit:${namespace}:${hash}`;

    const observer =
      new Redis(
        testUrl
      );

    const cache =
      new Map();

    const {
      consumeLimit,
    } =
      loadModule(
        "src/middleware/shared-rate-limit.ts",

        {},

        cache
      );

    /*
     * Retrieve the exact requestRedis
     * module instance that
     * shared-rate-limit loaded.
     */
    const {
      closeRequestRedis,
    } =
      loadModule(
        "src/lib/request-redis.ts",

        {},

        cache
      );

    t.after(
      async () => {
        await observer
          .del(
            expectedKey
          );

        closeRequestRedis();

        await observer
          .quit();

        if (
          oldRedisUrl ===
          undefined
        ) {
          delete process
            .env
            .REDIS_URL;
        } else {
          process.env
            .REDIS_URL =
            oldRedisUrl;
        }
      }
    );

    /*
     * Fire twenty operations at the
     * same limiter concurrently.
     *
     * Exactly five may enter.
     */
    const results =
      await Promise.all(
        Array.from(
          {
            length:
              20,
          },

          () =>
            consumeLimit(
              namespace,

              subject,

              5,

              60_000
            )
        )
      );

    const allowed =
      results.filter(
        (
          retryAfter
        ) =>
          retryAfter ===
          0
      );

    const blocked =
      results.filter(
        (
          retryAfter
        ) =>
          retryAfter >
          0
      );

    assert.equal(
      allowed.length,
      5
    );

    assert.equal(
      blocked.length,
      15
    );

    assert.ok(
      blocked.every(
        (
          value
        ) =>
          value >
          0 &&
          value <=
            60
      )
    );

    /*
     * Counter is shared/atomic.
     */
    assert.equal(
      await observer.get(
        expectedKey
      ),
      "5"
    );

    /*
     * Counter must expire.
     */
    const ttl =
      await observer.pttl(
        expectedKey
      );

    assert.ok(
      ttl >
        0 &&
      ttl <=
        60_000
    );

    /*
     * Raw identities must never
     * appear in Redis keys.
     */
    const keys =
      await observer.keys(
        `valyou:limit:${namespace}:*`
      );

    assert.equal(
      keys.length,
      1
    );

    assert.equal(
      keys[0].includes(
        subject
      ),
      false
    );
  }
);