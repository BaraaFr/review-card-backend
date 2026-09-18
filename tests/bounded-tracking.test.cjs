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

const input = {
  cardId:
    "card",

  storeId:
    "store",

  businessId:
    "business",

  visitorKey:
    "visitor",

  source:
    "NFC",

  metadata: {
    deviceType:
      "MOBILE",

    browser:
      "Safari",

    operatingSystem:
      "iOS",

    language:
      "en",

    isBot:
      false,
  },
};

test(
  "tracking budget returns without waiting for slow analytics",
  async () => {
    let completed =
      false;

    const {
      trackWithinBudget,
      drainTracking,
    } =
      loadModule(
        "src/modules/interactions/bounded-tracking.ts",

        {
          "./interaction-tracking.service.js":
            {
              recordInteraction:
                async () => {
                  await new Promise(
                    (
                      resolve
                    ) =>
                      setTimeout(
                        resolve,
                        500
                      )
                  );

                  completed =
                    true;
                },
            },
        }
      );

    const started =
      Date.now();

    await trackWithinBudget(
      input
    );

    const elapsed =
      Date.now() -
      started;

    /*
     * Tracking work is 500ms but customer
     * path should be released around 250ms.
     */
    assert.ok(
      elapsed <
        450
    );

    assert.equal(
      completed,
      false
    );

    /*
     * Graceful shutdown still waits for
     * outstanding tracking.
     */
    await drainTracking();

    assert.equal(
      completed,
      true
    );
  }
);

test(
    "tracking capacity is bounded instead of growing without limit",
    async (
      t
    ) => {
      t.mock.method(
        console,
        "warn",
        () => {}
      );
  
      let release;
  
      const blocker =
        new Promise(
          (
            resolve
          ) => {
            release =
              resolve;
          }
        );
  
      let calls =
        0;
  
      const {
        trackWithinBudget,
        drainTracking,
      } =
        loadModule(
          "src/modules/interactions/bounded-tracking.ts",
  
          {
            "./interaction-tracking.service.js":
              {
                recordInteraction:
                  async () => {
                    calls++;
  
                    await blocker;
                  },
              },
          }
        );
  
      /*
       * Start more work than the hard
       * pending limit.
       */
      await Promise.all(
        Array.from(
          {
            length:
              12,
          },
  
          () =>
            trackWithinBudget(
              input
            )
        )
      );
  
      /*
       * Only eight tracking operations
       * should have been accepted.
       */
      assert.equal(
        calls,
        8
      );
  
      release();
  
      await drainTracking();
    }
  );