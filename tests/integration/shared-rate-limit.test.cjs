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
} =
  require(
    "node:crypto"
  );

const RealRedis =
  require(
    "ioredis"
  );

const {
  loadModule,
} =
  require(
    "../load-module.cjs"
  );

const socket =
  process.env
    .TEST_REDIS_SOCKET;

const testUrl =
  process.env
    .TEST_REDIS_URL;

test(
  "Redis atomically enforces account/IP budgets across API instances and expires counters",

  {
    skip:
      !socket &&
      !testUrl,
  },

  async (
    t
  ) => {
    /*
     * =====================================================
     * Protect against production Redis
     * =====================================================
     */

    if (
      socket
    ) {
      assert.ok(
        socket.startsWith(
          "/private/tmp/"
        ) ||
        socket.startsWith(
          "/tmp/"
        ),

        "TEST_REDIS_SOCKET must point to a local temporary socket."
      );
    } else {
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

        "TEST_REDIS_URL must point to local Redis."
      );

      assert.equal(
        parsed.protocol,
        "redis:"
      );

      assert.equal(
        parsed.pathname,
        "/15",

        "Use Redis database 15 for integration tests."
      );
    }

    const endpoint =
      socket ||
      testUrl;

    /*
     * Each test run gets its own prefix.
     *
     * This prevents:
     *
     * previous failed tests
     * parallel test runs
     * local dev counters
     *
     * from affecting this test.
     */
    const prefix =
      `test-${randomUUID()}:`;

    const oldUrl =
      process.env
        .REDIS_URL;

    /*
     * login-rate-limit.ts reads REDIS_URL,
     * but our mocked Redis constructor below
     * controls the real endpoint.
     */
    process.env.REDIS_URL =
      "redis://unused.invalid";

    const clients =
      [];

    /*
     * Observer has NO key prefix.
     *
     * We use it for test inspection and cleanup.
     */
    const observer =
      new RealRedis(
        endpoint
      );

    observer.on(
      "error",
      () => {}
    );

    /*
     * Every Redis connection created by the
     * login limiter gets this test-specific prefix.
     */
    class Redis
      extends RealRedis {
      constructor(
        _url,
        options
      ) {
        super(
          endpoint,
          {
            ...options,

            keyPrefix:
              prefix,
          }
        );

        this.on(
          "error",
          () => {}
        );

        clients.push(
          this
        );
      }
    }

    t.after(
      async () => {
        /*
         * Delete every key created by this
         * specific test run.
         */
        const keys =
          await observer.keys(
            `${prefix}*`
          );

        if (
          keys.length
        ) {
          await observer.del(
            ...keys
          );
        }

        await Promise.allSettled(
          clients.map(
            (
              client
            ) =>
              client.quit()
          )
        );

        await observer
          .quit()
          .catch(
            () => {}
          );

        if (
          oldUrl ===
          undefined
        ) {
          delete process
            .env
            .REDIS_URL;
        } else {
          process.env
            .REDIS_URL =
            oldUrl;
        }
      }
    );

    /*
     * =====================================================
     * Simulate two API instances
     * =====================================================
     *
     * Each loadModule call creates a separate
     * module instance with a separate Redis client.
     *
     * Redis must remain the shared source of truth.
     */

    const first =
      loadModule(
        "src/modules/auth/login-rate-limit.ts",

        {
          ioredis: {
            default:
              Redis,
          },
        }
      );

    const second =
      loadModule(
        "src/modules/auth/login-rate-limit.ts",

        {
          ioredis: {
            default:
              Redis,
          },
        }
      );

    /*
     * =====================================================
     * Account limit
     * =====================================================
     *
     * Same account
     * different IPs
     *
     * Account budget = 10.
     */

    const email =
      `parallel-${Date.now()}@example.com`;

    const attempts =
      await Promise.all(
        Array.from(
          {
            length:
              20,
          },

          (
            _,
            index
          ) =>
            (
              index %
                2
                ? first
                : second
            )
              .consumeLoginAttempt(
                `192.0.2.${index + 1}`,

                email
              )
        )
      );

    const accountAllowed =
      attempts.filter(
        (
          result
        ) =>
          result.allowed
      );

    const accountBlocked =
      attempts.filter(
        (
          result
        ) =>
          !result.allowed
      );

    assert.equal(
      accountAllowed.length,
      10
    );

    assert.equal(
      accountBlocked.length,
      10
    );

    assert.ok(
      accountBlocked.every(
        (
          result
        ) =>
          result
            .retryAfterSeconds >
          0
      )
    );

    /*
     * =====================================================
     * IP limit
     * =====================================================
     *
     * Same IP
     * unique accounts
     *
     * IP budget = 100.
     */

    const ipAttempts =
      await Promise.all(
        Array.from(
          {
            length:
              101,
          },

          (
            _,
            index
          ) =>
            first
              .consumeLoginAttempt(
                "198.51.100.1",

                `ip-${Date.now()}-${index}@example.com`
              )
        )
      );

    assert.equal(
      ipAttempts.filter(
        (
          result
        ) =>
          result.allowed
      ).length,

      100
    );

    assert.equal(
      ipAttempts.filter(
        (
          result
        ) =>
          !result.allowed
      ).length,

      1
    );

    /*
     * =====================================================
     * Inspect Redis
     * =====================================================
     */

    const keys =
      await observer.keys(
        `${prefix}auth:login:*`
      );

    assert.ok(
      keys.length >
        0
    );

    /*
     * Counters must expire.
     */
    const expirations =
      await Promise.all(
        keys.map(
          (
            key
          ) =>
            observer.pttl(
              key
            )
        )
      );

    assert.ok(
      expirations.every(
        (
          ttl
        ) =>
          ttl >
            0 &&
          ttl <=
            900_000
      )
    );

    /*
     * Emails and IPs must never appear
     * directly inside Redis keys.
     */
    assert.ok(
      keys.every(
        (
          key
        ) =>
          !key.includes(
            "@"
          ) &&
          !key.includes(
            "198.51.100.1"
          )
      )
    );
  }
);