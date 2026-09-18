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

function response() {
  return {
    headers: {},

    statusCode:
      200,

    redirectedTo:
      null,

    setHeader(
      key,
      value
    ) {
      this.headers[
        key
      ] =
        value;
    },

    cookie() {},

    status(
      value
    ) {
      this.statusCode =
        value;

      return this;
    },

    send() {
      return this;
    },

    redirect(
      status,
      location
    ) {
      this.statusCode =
        status;

      this.redirectedTo =
        location;

      return this;
    },
  };
}

test(
  "HEAD card requests redirect without creating analytics",
  async () => {
    let visitorCalls =
      0;

    let trackingCalls =
      0;

    const {
      redirectCardController,
    } =
      loadModule(
        "src/modules/redirect/redirect.controller.ts",

        {
          "./redirect.service.js":
            {
              getCardRedirectContext:
                async () => ({
                  cardId:
                    "card",

                  storeId:
                    "store",

                  businessId:
                    "business",

                  googleReviewUrl:
                    "https://google.com",
                }),
            },

          "../interactions/anonymous-visitor.util.js":
            {
              getOrCreateAnonymousVisitor:
                () => {
                  visitorCalls++;

                  return {
                    visitorKey:
                      "visitor",
                  };
                },
            },

          "../interactions/request-metadata.util.js":
            {
              getInteractionRequestMetadata:
                () => ({
                  deviceType:
                    "UNKNOWN",

                  browser:
                    null,

                  operatingSystem:
                    null,

                  language:
                    null,

                  isBot:
                    false,
                }),
            },

          "../interactions/bounded-tracking.js":
            {
              trackWithinBudget:
                async () => {
                  trackingCalls++;
                },
            },

          "../../config/env.js":
            {
              env: {
                FRONTEND_URL:
                  "http://localhost:3000",
              },
            },
        }
      );

    const res =
      response();

    await redirectCardController(
      {
        method:
          "HEAD",

        params: {
          code:
            "abc",
        },

        query: {},
      },

      res,

      (
        error
      ) => {
        throw error;
      }
    );

    assert.equal(
      res.statusCode,
      302
    );

    assert.equal(
      visitorCalls,
      0
    );

    assert.equal(
      trackingCalls,
      0
    );
  }
);