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
  response,
} =
  require(
    "./load-module.cjs"
  );

/*
 * =========================================================
 * Trusted Origin
 * =========================================================
 */

test(
  "unsafe requests require an exact trusted Origin",
  () => {
    const {
      trustedOrigin,
    } =
      loadModule(
        "src/middleware/trusted-origin.ts",

        {
          "../config/env.js":
            {
              env: {
                FRONTEND_URL:
                  "http://localhost:3000",

                PUBLIC_API_URL:
                  "http://localhost:4000",
              },
            },
        }
      );

    const cases = [
      {
        method:
          "POST",

        origin:
          "http://localhost:3000",

        allowed:
          true,
      },

      {
        method:
          "POST",

        origin:
          "http://localhost:4000",

        allowed:
          true,
      },

      {
        method:
          "POST",

        origin:
          undefined,

        allowed:
          false,
      },

      {
        method:
          "POST",

        origin:
          "https://evil.example",

        allowed:
          false,
      },

      {
        method:
          "PATCH",

        origin:
          "https://localhost:3000.evil.example",

        allowed:
          false,
      },

      {
        method:
          "GET",

        origin:
          undefined,

        allowed:
          true,
      },

      {
        method:
          "HEAD",

        origin:
          undefined,

        allowed:
          true,
      },

      {
        method:
          "OPTIONS",

        origin:
          undefined,

        allowed:
          true,
      },
    ];

    for (
      const item
      of cases
    ) {
      let error;

      trustedOrigin(
        {
          method:
            item.method,

          get:
            () =>
              item.origin,
        },

        response(),

        (
          value
        ) => {
          error =
            value;
        }
      );

      assert.equal(
        !error,
        item.allowed,

        `${item.method} ${item.origin ?? "no-origin"}`
      );

      if (
        !item.allowed
      ) {
        assert.equal(
          error.code,
          "UNTRUSTED_ORIGIN"
        );

        assert.equal(
          error.status,
          403
        );
      }
    }
  }
);

/*
 * =========================================================
 * Readiness success
 * =========================================================
 */

test(
  "readiness succeeds only when PostgreSQL and Redis respond",
  async () => {
    const {
      isReady,
    } =
      loadModule(
        "src/lib/readiness.ts",

        {
          "./prisma.js":
            {
              prisma:
                {
                  $queryRaw:
                    async () =>
                      [
                        {
                          value:
                            1,
                        },
                      ],
                },
            },

          "./request-redis.js":
            {
              requestRedis:
                async () =>
                  ({
                    ping:
                      async () =>
                        "PONG",
                  }),
            },
        }
      );

    assert.equal(
      await isReady(),
      true
    );
  }
);

/*
 * =========================================================
 * PostgreSQL unavailable
 * =========================================================
 */

test(
  "readiness fails when PostgreSQL is unavailable",
  async () => {
    const {
      isReady,
    } =
      loadModule(
        "src/lib/readiness.ts",

        {
          "./prisma.js":
            {
              prisma:
                {
                  $queryRaw:
                    async () => {
                      throw new Error(
                        "database unavailable"
                      );
                    },
                },
            },

          "./request-redis.js":
            {
              requestRedis:
                async () =>
                  ({
                    ping:
                      async () =>
                        "PONG",
                  }),
            },
        }
      );

    assert.equal(
      await isReady(),
      false
    );
  }
);

/*
 * =========================================================
 * Redis unavailable
 * =========================================================
 */

test(
  "readiness fails when Redis is unavailable",
  async () => {
    const {
      isReady,
    } =
      loadModule(
        "src/lib/readiness.ts",

        {
          "./prisma.js":
            {
              prisma:
                {
                  $queryRaw:
                    async () =>
                      [
                        {
                          value:
                            1,
                        },
                      ],
                },
            },

          "./request-redis.js":
            {
              requestRedis:
                async () => {
                  throw new Error(
                    "redis unavailable"
                  );
                },
            },
        }
      );

    assert.equal(
      await isReady(),
      false
    );
  }
);

/*
 * =========================================================
 * Shared limiter fails closed
 * =========================================================
 */

test(
  "shared rate limiter fails closed when Redis is unavailable",
  async () => {
    const {
      consumeLimit,
    } =
      loadModule(
        "src/middleware/shared-rate-limit.ts",

        {
          "../lib/request-redis.js":
            {
              requestRedis:
                async () => {
                  throw new Error(
                    "redis unavailable"
                  );
                },
            },
        }
      );

    await assert.rejects(
      () =>
        consumeLimit(
          "test",
          "subject",
          5,
          60_000
        ),

      (
        error
      ) => {
        assert.equal(
          error.status,
          503
        );

        assert.equal(
          error.code,
          "RATE_LIMIT_UNAVAILABLE"
        );

        return true;
      }
    );
  }
);