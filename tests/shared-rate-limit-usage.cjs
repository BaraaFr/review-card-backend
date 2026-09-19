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
  "limit usage reads the counter without incrementing it",

  async () => {
    let gets =
      0;

    let pttls =
      0;

    let evals =
      0;

    const api =
      loadModule(
        "src/middleware/shared-rate-limit.ts",

        {
          "../lib/request-redis.js":
            {
              requestRedis:
                async () => ({
                  get:
                    async () => {
                      gets++;

                      return "80";
                    },

                  pttl:
                    async () => {
                      pttls++;

                      return 5000;
                    },

                  eval:
                    async () => {
                      evals++;

                      return 0;
                    },
                }),
            },
        }
      );

    const usage =
      await api
        .getLimitUsage(
          "google-upstream",
          "deployment",
          200
        );

    assert.equal(
      usage.used,
      80
    );

    assert.equal(
      usage.remaining,
      120
    );

    assert.equal(
      usage.percentage,
      40
    );

    assert.equal(
      usage.resetInSeconds,
      5
    );

    assert.equal(
      gets,
      1
    );

    assert.equal(
      pttls,
      1
    );

    /*
     * Critical:
     *
     * observing quota must not consume quota.
     */
    assert.equal(
      evals,
      0
    );
  }
);