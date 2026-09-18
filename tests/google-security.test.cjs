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
  "Google URLs reject credentials, untrusted hosts and nonstandard ports",
  () => {
    const {
      validateGoogleUrl,
    } =
      loadModule(
        "src/modules/google/google-url.util.ts"
      );

    const allowed = [
      "https://maps.app.goo.gl/example",

      "https://g.page/example/review",

      "https://maps.google.com/place",

      "https://www.google.com/maps/place/example",
    ];

    for (
      const url
      of allowed
    ) {
      assert.doesNotThrow(
        () =>
          validateGoogleUrl(
            url
          )
      );
    }

    const rejected = [
      "http://google.com",

      "https://google.com.evil.test",

      "https://user:pass@google.com",

      "https://google.com:8443",

      "https://example.com",
    ];

    for (
      const url
      of rejected
    ) {
      assert.throws(
        () =>
          validateGoogleUrl(
            url
          )
      );
    }
  }
);

test(
    "Google upstream budget blocks requests before fetch when exhausted",
    async () => {
      let fetchCalls =
        0;
  
      const originalFetch =
        global.fetch;
  
      global.fetch =
        async () => {
          fetchCalls++;
  
          return {
            ok:
              true,
          };
        };
  
      try {
        const {
          googleFetch,
        } =
          loadModule(
            "src/modules/google/google-fetch.ts",
  
            {
              "../../middleware/shared-rate-limit.js":
                {
                  consumeLimit:
                    async () =>
                      60,
                },
  
              "../../config/env.js":
                {
                  env: {
                    GOOGLE_API_DAILY_LIMIT:
                      200,
                  },
                },
            }
          );
  
        await assert.rejects(
          () =>
            googleFetch(
              "https://places.googleapis.com/v1/test",
  
              {
                method:
                  "GET",
              }
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
              "GOOGLE_BUDGET_EXHAUSTED"
            );
  
            return true;
          }
        );
  
        /*
         * Critical:
         *
         * Google was never called.
         */
        assert.equal(
          fetchCalls,
          0
        );
      } finally {
        global.fetch =
          originalFetch;
      }
    }
  );